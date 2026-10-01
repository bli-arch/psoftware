import { browser } from "$app/environment";
import { invoke } from "@tauri-apps/api/core";

export type PSoftwareDocument = "conditions" | "license";

export async function readPSoftwareDocument(document: PSoftwareDocument) {
    if (!browser) throw new Error("Les documents PSoftware sont disponibles uniquement dans l’application.");

    if ("__TAURI_INTERNALS__" in window) {
        return invoke<string>("read_psoftware_document", { document });
    }

    const response = await fetch(`/${document === "conditions" ? "CONDITIONS.txt" : "LICENSE.txt"}`, {
        cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
}
