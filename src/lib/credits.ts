import { apiGet } from "$lib/api";

export type Credit = {
    id: string;
    name: string;
    version: string;
    license: string;
    source?: string;
    file: string;
};

export async function readPSoftwareCredits() {
    const response = await fetch("/credits/index.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json() as Promise<Credit[]>;
}

export function readPSoftwareCredit(credit: Credit) {
    if (!credit.file.startsWith("licenses/") || credit.file.includes("..")) {
        return Promise.reject(new Error("Chemin de licence invalide."));
    }
    return fetch(`/credits/${credit.file}`).then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
    });
}

export async function readPServerCredits() {
    return apiGet("/system/credits/", false, {
        redirectOnFailure: false,
        syncSettingsVersion: false,
    }) as Promise<Credit[]>;
}

export async function readPServerCredit(credit: Credit) {
    const response = await apiGet(`/system/credits/${encodeURIComponent(credit.id)}/`, false, {
        redirectOnFailure: false,
        syncSettingsVersion: false,
    }) as { content: string };
    return response.content;
}
