import { browser } from "$app/environment";
import { goto } from "$app/navigation";
import { invoke } from "@tauri-apps/api/core";

import { getLocalDeviceId } from "$lib/deviceIdentity";
import { getConfiguredApiBase } from "$lib/onboarding";

const FALLBACK_API_BASE = "https://localhost:8000/api/v1";
const DEV_PROXY_API_BASE = "/api/v1";
const API_REQUEST_TIMEOUT_MS = 30_000;
const PUBLIC_ROUTES = new Set(["/", "/login", "/onboarding", "/server-debug"]);

type ApiMethod = "get" | "post" | "put" | "patch" | "delete";

type TauriApiResponse = {
    status: number;
    body: unknown;
};

type ApiRequestOptions = {
    redirectOnFailure?: boolean;
    syncSettingsVersion?: boolean;
};

type ApiError = Error & {
    status?: number;
    data?: unknown;
    connectionFailed?: boolean;
    authRedirect?: boolean;
};

let redirectingTo: string | null = null;
let connectivityRedirectSuspensions = 0;

export function suspendConnectivityRedirect() {
    connectivityRedirectSuspensions += 1;
    let active = true;
    return () => {
        if (!active) return;
        active = false;
        connectivityRedirectSuspensions = Math.max(0, connectivityRedirectSuspensions - 1);
    };
}

function getApiBase() {
    if (!browser) return FALLBACK_API_BASE;
    const configured = getConfiguredApiBase();
    return !isTauriRuntime() && configured === FALLBACK_API_BASE ? DEV_PROXY_API_BASE : configured;
}

function isTauriRuntime() {
    return browser && "__TAURI_INTERNALS__" in window;
}

function getCSRF() {
    return document.cookie
        .split("; ")
        .find((cookie) => cookie.startsWith("csrftoken="))
        ?.split("=")[1] ?? "";
}

function isPublicRoute(path: string) {
    return PUBLIC_ROUTES.has(path);
}

function redirectOnce(path: string) {
    if (!browser || redirectingTo === path || window.location.pathname === path) return;

    redirectingTo = path;
    void goto(path, { replaceState: true }).finally(() => {
        redirectingTo = null;
    });
}

function syncSettingsVersion(data: unknown) {
    if (!data || typeof data !== "object" || !("settingsVersion" in data)) return;

    const version = Number((data as { settingsVersion?: unknown }).settingsVersion);
    if (!Number.isInteger(version)) return;

    void import("$lib/settings").then(({ refreshSettingsIfStale }) => {
        void refreshSettingsIfStale(version);
    });
}

function handleConnectivityFailure(error: unknown, options: ApiRequestOptions) {
    if (options.redirectOnFailure === false) return;
    if (connectivityRedirectSuspensions === 0) {
        void import("$lib/system").then(({ clearBootstrapCache }) => {
            clearBootstrapCache();
            redirectOnce("/server-debug");
        });
    }

    if (typeof error === "object" && error !== null) {
        (error as ApiError).connectionFailed = true;
    }
}

function isAuthenticationFailure(status: number, data: unknown) {
    if (status === 401) return true;
    if (status !== 403) return false;

    const detail = data && typeof data === "object" && "detail" in data
        ? String((data as { detail?: unknown }).detail)
        : "";

    return /authentication|credentials|csrf|session/i.test(detail);
}

function clearDesktopApiCookies() {
    if (!isTauriRuntime()) return;
    void invoke("clear_api_cookies", { apiBase: getApiBase() }).catch((error) => {
        console.warn("Unable to clear desktop API cookies.", error);
    });
}

function handleUnauthorized(status: number, data: unknown, options: ApiRequestOptions) {
    if (options.redirectOnFailure === false || !browser) return false;
    if (!isAuthenticationFailure(status, data)) return false;
    if (isPublicRoute(window.location.pathname)) return false;

    clearDesktopApiCookies();
    void import("$lib/auth").then(({ clearAuthState }) => clearAuthState());
    void import("$lib/system").then(({ clearBootstrapCache }) => clearBootstrapCache());
    redirectOnce("/login");
    return true;
}

function handleResponse(status: number, parsed: unknown, returnStatus: boolean, options: ApiRequestOptions) {
    if (options.syncSettingsVersion !== false) {
        syncSettingsVersion(parsed);
    }

    if (status < 200 || status >= 300) {
        const authRedirect = handleUnauthorized(status, parsed, options);

        const error = new Error(`HTTP error! status: ${status}`);
        (error as ApiError).status = status;
        (error as ApiError).data = parsed;
        (error as ApiError).authRedirect = authRedirect;
        throw error;
    }

    if (status === 204) {
        return returnStatus ? { status, data: null } : null;
    }

    return returnStatus ? { status, data: parsed } : parsed;
}

async function tauriFetch(
    method: ApiMethod,
    path: string,
    body?: Record<string, unknown>,
    returnStatus = false,
    options: ApiRequestOptions = {},
): Promise<any> {
    let responseText: string;
    try {
        responseText = await invoke<string>("api_request", {
            method: method.toUpperCase(),
            apiBase: getApiBase(),
            path,
            body: body ?? null,
            deviceId: getLocalDeviceId(),
        });
    } catch (error) {
        handleConnectivityFailure(error, options);
        throw error;
    }

    const parsed = JSON.parse(responseText) as TauriApiResponse;
    return handleResponse(parsed.status, parsed.body ?? null, returnStatus, options);
}

async function browserFetch(
    method: ApiMethod,
    url: string,
    body?: Record<string, unknown>,
    returnStatus = false,
    options: ApiRequestOptions = {},
): Promise<any> {
    const requestOptions: RequestInit = {
        method: method.toUpperCase(),
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCSRF(),
            "X-PSoft-Device-Id": getLocalDeviceId(),
        },
        credentials: "include",
    };

    if (method !== "get" && body) {
        requestOptions.body = JSON.stringify(body);
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);
    requestOptions.signal = controller.signal;

    let response: Response;
    let text: string;
    try {
        response = await fetch(url, requestOptions);
        text = await response.text();
    } catch (error) {
        handleConnectivityFailure(error, options);
        throw error;
    } finally {
        window.clearTimeout(timeout);
    }

    const parsed = text ? JSON.parse(text) : null;
    return handleResponse(response.status, parsed, returnStatus, options);
}

async function request(
    method: ApiMethod,
    url: string,
    body?: Record<string, unknown>,
    returnStatus = false,
    options: ApiRequestOptions = {},
) {
    return isTauriRuntime()
        ? tauriFetch(method, url, body, returnStatus, options)
        : browserFetch(method, `${getApiBase()}${url}`, body, returnStatus, options);
}

export async function apiGet(url: string, returnStatus = false, options: ApiRequestOptions = {}): Promise<any> {
    return request("get", url, undefined, returnStatus, options);
}

export async function apiPost(
    url: string,
    body: Record<string, unknown>,
    returnStatus = false,
    options: ApiRequestOptions = {},
): Promise<any> {
    return request("post", url, body, returnStatus, options);
}

export async function apiPut(
    url: string,
    body: Record<string, unknown>,
    returnStatus = false,
    options: ApiRequestOptions = {},
): Promise<any> {
    return request("put", url, body, returnStatus, options);
}

export async function apiPatch(
    url: string,
    body: Record<string, unknown>,
    returnStatus = false,
    options: ApiRequestOptions = {},
): Promise<any> {
    return request("patch", url, body, returnStatus, options);
}

export async function apiDelete(url: string, returnStatus = false, options: ApiRequestOptions = {}): Promise<any> {
    return request("delete", url, undefined, returnStatus, options);
}

export async function apiUploadServerBackup(file: File, recoveryKey: string, uploadToken: string): Promise<any> {
    if (isTauriRuntime()) {
        let responseText: string;
        try {
            const headers: Record<string, string> = {
                "x-psoft-api-base": getApiBase(),
                "x-psoft-filename": btoa(String.fromCharCode(...new TextEncoder().encode(file.name))),
                "x-psoft-upload-token": uploadToken,
                "x-psoft-device-id": getLocalDeviceId(),
            };
            if (recoveryKey) headers["x-psoft-recovery-key"] = recoveryKey;
            responseText = await invoke<string>("upload_server_backup", await file.arrayBuffer(), {
                headers,
            });
        } catch (error) {
            handleConnectivityFailure(error, {});
            throw error;
        }
        const response = JSON.parse(responseText) as TauriApiResponse;
        return handleResponse(response.status, response.body ?? null, false, {});
    }

    const form = new FormData();
    form.append("backup", file, file.name);
    form.append("confirm", "true");
    if (recoveryKey) form.append("recoveryKey", recoveryKey);
    let response: Response;
    try {
        response = await fetch(`${getApiBase()}/admin/server/backups/restore-upload/`, {
            method: "POST",
            headers: {
                "X-CSRFToken": getCSRF(),
                "X-PSoft-Device-Id": getLocalDeviceId(),
                "X-PSoft-Restore-Token": uploadToken,
            },
            credentials: "include",
            body: form,
        });
    } catch (error) {
        handleConnectivityFailure(error, {});
        throw error;
    }
    const text = await response.text();
    return handleResponse(response.status, text ? JSON.parse(text) : null, false, {});
}

export async function apiUploadCompanyLogo(png: Blob, svg: string | null): Promise<any> {
    if (isTauriRuntime()) {
        let responseText: string;
        try {
            responseText = await invoke<string>("upload_company_logo", {
                apiBase: getApiBase(),
                png: Array.from(new Uint8Array(await png.arrayBuffer())),
                svg,
                deviceId: getLocalDeviceId(),
            });
        } catch (error) {
            handleConnectivityFailure(error, {});
            throw error;
        }
        const response = JSON.parse(responseText) as TauriApiResponse;
        return handleResponse(response.status, response.body ?? null, false, {});
    }

    const form = new FormData();
    form.append("png", png, "logo.png");
    if (svg !== null) {
        form.append("svg", new Blob([svg], { type: "image/svg+xml" }), "logo.svg");
    }

    let response: Response;
    try {
        response = await fetch(`${getApiBase()}/settings/company-profile/logo`, {
            method: "POST",
            headers: {
                "X-CSRFToken": getCSRF(),
                "X-PSoft-Device-Id": getLocalDeviceId(),
            },
            credentials: "include",
            body: form,
        });
    } catch (error) {
        handleConnectivityFailure(error, {});
        throw error;
    }
    const text = await response.text();
    return handleResponse(response.status, text ? JSON.parse(text) : null, false, {});
}

export async function apiDownloadCompanyLogo(
    variant: "png" | "svg" = "png",
    options: ApiRequestOptions = {},
): Promise<ArrayBuffer> {
    if (isTauriRuntime()) {
        try {
            return await invoke<ArrayBuffer>("download_company_logo", {
                apiBase: getApiBase(),
                variant,
                deviceId: getLocalDeviceId(),
            });
        } catch (error) {
            if (!String(error).startsWith("HTTP ")) handleConnectivityFailure(error, options);
            throw error;
        }
    }

    let response: Response;
    try {
        response = await fetch(`${getApiBase()}/settings/company-profile/logo?variant=${variant}`, {
            headers: { "X-PSoft-Device-Id": getLocalDeviceId() },
            credentials: "include",
            cache: "no-store",
        });
    } catch (error) {
        handleConnectivityFailure(error, options);
        throw error;
    }
    if (!response.ok) {
        const text = await response.text();
        handleResponse(response.status, text ? JSON.parse(text) : null, false, options);
    }
    return response.arrayBuffer();
}

export async function apiDownloadServerDatabase(currentPassword: string): Promise<ArrayBuffer> {
    if (isTauriRuntime()) {
        try {
            const response = await invoke<ArrayBuffer>("download_server_database", {
                apiBase: getApiBase(),
                currentPassword,
                deviceId: getLocalDeviceId(),
            });
            return response;
        } catch (error) {
            if (!String(error).startsWith("HTTP ")) handleConnectivityFailure(error, {});
            throw error;
        }
    }

    let response: Response;
    try {
        response = await fetch(`${getApiBase()}/admin/server/database/export/download/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": getCSRF(),
                "X-PSoft-Device-Id": getLocalDeviceId(),
            },
            credentials: "include",
            body: JSON.stringify({ current_password: currentPassword }),
        });
    } catch (error) {
        handleConnectivityFailure(error, {});
        throw error;
    }
    if (!response.ok) {
        const text = await response.text();
        handleResponse(response.status, text ? JSON.parse(text) : null, false, {});
    }
    return response.arrayBuffer();
}

export async function apiDownloadClientData(uid: string): Promise<ArrayBuffer> {
    const clientUID = uid.trim();
    if (!clientUID) throw new Error("Identifiant client invalide.");

    if (isTauriRuntime()) {
        try {
            return await invoke<ArrayBuffer>("download_client_data", {
                apiBase: getApiBase(),
                uid: clientUID,
                deviceId: getLocalDeviceId(),
            });
        } catch (error) {
            if (!String(error).startsWith("HTTP ")) handleConnectivityFailure(error, {});
            throw error;
        }
    }

    let response: Response;
    try {
        response = await fetch(`${getApiBase()}/core/clients/data-export/download/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": getCSRF(),
                "X-PSoft-Device-Id": getLocalDeviceId(),
            },
            credentials: "include",
            cache: "no-store",
            body: JSON.stringify({ uid: clientUID }),
        });
    } catch (error) {
        handleConnectivityFailure(error, {});
        throw error;
    }
    if (!response.ok) {
        const text = await response.text();
        handleResponse(response.status, text ? JSON.parse(text) : null, false, {});
    }
    return response.arrayBuffer();
}

export async function apiDownloadServerBackup(filename: string): Promise<ArrayBuffer> {
    if (isTauriRuntime()) {
        try {
            return await invoke<ArrayBuffer>("download_server_backup", {
                apiBase: getApiBase(),
                filename,
                deviceId: getLocalDeviceId(),
            });
        } catch (error) {
            if (!String(error).startsWith("HTTP ")) handleConnectivityFailure(error, {});
            throw error;
        }
    }

    let response: Response;
    try {
        response = await fetch(`${getApiBase()}/admin/server/backups/${encodeURIComponent(filename)}/download/`, {
            headers: { "X-PSoft-Device-Id": getLocalDeviceId() },
            credentials: "include",
        });
    } catch (error) {
        handleConnectivityFailure(error, {});
        throw error;
    }
    if (!response.ok) {
        const text = await response.text();
        handleResponse(response.status, text ? JSON.parse(text) : null, false, {});
    }
    return response.arrayBuffer();
}

export async function apiDownloadDocument(documentId: number): Promise<ArrayBuffer> {
    if (!Number.isSafeInteger(documentId) || documentId <= 0) {
        throw new Error("Identifiant de document invalide.");
    }

    if (isTauriRuntime()) {
        try {
            return await invoke<ArrayBuffer>("download_document", {
                apiBase: getApiBase(),
                documentId,
                deviceId: getLocalDeviceId(),
            });
        } catch (error) {
            if (!String(error).startsWith("HTTP ")) handleConnectivityFailure(error, {});
            throw error;
        }
    }

    let response: Response;
    try {
        response = await fetch(`${getApiBase()}/core/documents/${documentId}/download/`, {
            headers: { "X-PSoft-Device-Id": getLocalDeviceId() },
            credentials: "include",
        });
    } catch (error) {
        handleConnectivityFailure(error, {});
        throw error;
    }
    if (!response.ok) {
        const text = await response.text();
        handleResponse(response.status, text ? JSON.parse(text) : null, false, {});
    }
    return response.arrayBuffer();
}

export function isAuthRedirectError(error: unknown) {
    return Boolean(error && typeof error === "object" && (error as ApiError).authRedirect);
}
