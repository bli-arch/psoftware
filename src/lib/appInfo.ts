import { browser } from "$app/environment";

declare const __PSOFT_VERSION__: string;

export const PSOFTWARE_VERSION = __PSOFT_VERSION__;

export function isInstalledTauriApp() {
    return browser && "__TAURI_INTERNALS__" in window;
}

export async function getPSoftwareVersion() {
    if (isInstalledTauriApp()) {
        const { getVersion } = await import("@tauri-apps/api/app");
        return getVersion();
    }

    return PSOFTWARE_VERSION;
}
