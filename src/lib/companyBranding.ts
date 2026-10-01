import { apiDownloadCompanyLogo } from "$lib/api";
import { writable } from "svelte/store";

const STORAGE_PREFIX = "psoftware.company-branding.";

export type CompanyBrandingMetadata = {
    companyName: string | null;
    logoHash: string | null;
};

type CachedCompanyBranding = {
    companyName: string;
    logoHash: string;
    logoUrl: string | null;
    logoVariant: "svg" | "png" | null;
};

export const companyBranding = writable({
    companyName: "PSoftware",
    logoUrl: null as string | null,
});

let activeServerId = "";
let loadRevision = 0;

function readCachedBranding(serverId: string): CachedCompanyBranding | null {
    try {
        const value = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}${serverId}`) || "null");
        if (!value || typeof value !== "object") return null;
        const logoUrl = typeof value.logoUrl === "string"
            && (value.logoUrl.startsWith("data:image/svg+xml;base64,") || value.logoUrl.startsWith("data:image/png;base64,"))
                ? value.logoUrl
                : null;
        return {
            companyName: typeof value.companyName === "string" ? value.companyName : "",
            logoHash: typeof value.logoHash === "string" ? value.logoHash : "",
            logoUrl,
            logoVariant: value.logoVariant === "svg" || value.logoVariant === "png"
                ? value.logoVariant
                : null,
        };
    } catch {
        return null;
    }
}

function cacheBranding(serverId: string, branding: CachedCompanyBranding) {
    try {
        localStorage.setItem(`${STORAGE_PREFIX}${serverId}`, JSON.stringify(branding));
    } catch {
        // The live branding remains available when persistent storage is full or disabled.
    }
}

function logoDataUrl(data: ArrayBuffer, variant: "svg" | "png"): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string"
            ? resolve(reader.result)
            : reject(new Error("Le logo est invalide."));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(new Blob([data], { type: `image/${variant === "svg" ? "svg+xml" : "png"}` }));
    });
}

function logoVariant(data: ArrayBuffer, requestedVariant: "svg" | "png") {
    const bytes = new Uint8Array(data);
    return bytes.length >= 8
        && bytes[0] === 0x89
        && bytes[1] === 0x50
        && bytes[2] === 0x4e
        && bytes[3] === 0x47
        && bytes[4] === 0x0d
        && bytes[5] === 0x0a
        && bytes[6] === 0x1a
        && bytes[7] === 0x0a
        ? "png"
        : requestedVariant;
}

async function downloadPreferredLogo() {
    const options = { redirectOnFailure: false };
    try {
        const data = await apiDownloadCompanyLogo("svg", options);
        const variant = logoVariant(data, "svg");
        return {
            logoUrl: await logoDataUrl(data, variant),
            logoVariant: variant,
        };
    } catch {
        return {
            logoUrl: await logoDataUrl(await apiDownloadCompanyLogo("png", options), "png"),
            logoVariant: "png" as const,
        };
    }
}

export async function prepareCompanyBranding(serverId: string, metadata: CompanyBrandingMetadata) {
    const revision = ++loadRevision;
    activeServerId = serverId;
    const cached = readCachedBranding(serverId);
    const companyName = metadata.companyName?.trim().slice(0, 120)
        || cached?.companyName
        || "PSoftware";
    const logoHash = metadata.logoHash ?? cached?.logoHash ?? "";

    if (!logoHash) {
        const branding = { companyName, logoHash: "", logoUrl: null, logoVariant: null };
        companyBranding.set({ companyName, logoUrl: null });
        cacheBranding(serverId, branding);
        return;
    }

    if (cached?.logoHash === logoHash && cached.logoUrl && cached.logoVariant) {
        const branding = { ...cached, companyName };
        companyBranding.set({ companyName, logoUrl: branding.logoUrl });
        cacheBranding(serverId, branding);
        return;
    }

    companyBranding.set({ companyName, logoUrl: cached?.logoUrl ?? null });
    try {
        const { logoUrl, logoVariant } = await downloadPreferredLogo();
        if (revision !== loadRevision) return;
        const branding = { companyName, logoHash, logoUrl, logoVariant };
        companyBranding.set({ companyName, logoUrl });
        cacheBranding(serverId, branding);
    } catch {
        if (revision !== loadRevision) return;
        cacheBranding(serverId, {
            companyName,
            logoHash: cached?.logoHash ?? "",
            logoUrl: cached?.logoUrl ?? null,
            logoVariant: cached?.logoVariant ?? null,
        });
    }
}

export function syncCompanyBranding(metadata: CompanyBrandingMetadata) {
    if (activeServerId) void prepareCompanyBranding(activeServerId, metadata);
}
