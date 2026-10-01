import { browser } from "$app/environment";
import { invoke } from "@tauri-apps/api/core";

export type DiscoveredPServer = {
    id: string;
    name: string;
    apiBase: string;
    apiVersion: string;
};

export function discoverPServers(): Promise<DiscoveredPServer[]> {
    if (!browser || !("__TAURI_INTERNALS__" in window)) {
        throw new Error("La découverte réseau est disponible dans l'application Windows.");
    }
    return invoke("discover_pservers");
}
