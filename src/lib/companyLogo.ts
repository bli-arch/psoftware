import { apiDelete, apiDownloadCompanyLogo, apiUploadCompanyLogo } from "$lib/api";
import { setCompanyProfile, type CompanyProfile } from "$lib/companyProfile";

export const MAX_COMPANY_LOGO_SOURCE_BYTES = 4 * 1024 * 1024;
const MAX_RENDERED_DIMENSION = 2048;

const supportedMimeTypes = new Set([
    "image/svg+xml",
    "image/png",
    "image/jpeg",
    "image/webp",
]);

const supportedExtensions = new Set(["svg", "png", "jpg", "jpeg", "webp"]);

function logoExtension(file: File) {
    return file.name.toLowerCase().split(".").pop() ?? "";
}

function isSupportedLogo(file: File) {
    return supportedMimeTypes.has(file.type) || supportedExtensions.has(logoExtension(file));
}

async function rasterizeLogo(file: File): Promise<Blob> {
    const sourceURL = URL.createObjectURL(file);
    try {
        const image = new Image();
        image.decoding = "async";
        await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () => reject(new Error("Le logo ne peut pas être lu."));
            image.src = sourceURL;
        });

        const sourceWidth = image.naturalWidth || image.width;
        const sourceHeight = image.naturalHeight || image.height;
        if (!sourceWidth || !sourceHeight) {
            throw new Error("Les dimensions du logo sont invalides.");
        }

        const scale = Math.min(1, MAX_RENDERED_DIMENSION / Math.max(sourceWidth, sourceHeight));
        const width = Math.max(1, Math.round(sourceWidth * scale));
        const height = Math.max(1, Math.round(sourceHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Le logo ne peut pas être converti.");
        context.clearRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);

        return await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error("Le logo ne peut pas être converti en PNG."));
            }, "image/png");
        });
    } finally {
        URL.revokeObjectURL(sourceURL);
    }
}

export async function uploadCompanyLogo(file: File): Promise<CompanyProfile> {
    if (!file || !isSupportedLogo(file)) {
        throw new Error("Formats acceptés : SVG, PNG, JPEG ou WebP.");
    }
    if (file.size <= 0 || file.size > MAX_COMPANY_LOGO_SOURCE_BYTES) {
        throw new Error("Le logo dépasse la taille maximale autorisée.");
    }

    const svg = logoExtension(file) === "svg" || file.type === "image/svg+xml"
        ? await file.text()
        : null;
    if (svg) validateLogoSVGSource(svg);
    const png = await rasterizeLogo(file);
    if (png.size > MAX_COMPANY_LOGO_SOURCE_BYTES) {
        throw new Error("Le logo dépasse la taille maximale autorisée.");
    }
    const profile = await apiUploadCompanyLogo(png, svg) as CompanyProfile;
    setCompanyProfile(profile);
    return profile;
}

export async function removeCompanyLogo(): Promise<CompanyProfile> {
    const profile = await apiDelete("/settings/company-profile/logo") as CompanyProfile;
    setCompanyProfile(profile);
    return profile;
}

export async function loadCompanyLogoPreview(): Promise<Blob> {
    return new Blob([await apiDownloadCompanyLogo("png")], { type: "image/png" });
}

function validateLogoSVGSource(svg: string): void {
    const source = svg.toLowerCase();
    if (source.includes("<!doctype") || source.includes("<!entity")) {
        throw new Error("Le SVG contient une déclaration externe interdite.");
    }

    const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
    if (parsed.querySelector("parsererror") || parsed.documentElement?.localName.toLowerCase() !== "svg") {
        throw new Error("Le fichier SVG est invalide.");
    }

    for (const element of Array.from(parsed.getElementsByTagName("*"))) {
        const name = element.localName.toLowerCase();
        if (["script", "foreignobject", "iframe", "object", "embed"].includes(name)) {
            throw new Error("Le SVG contient un élément interdit.");
        }
        for (const attribute of Array.from(element.attributes)) {
            const attributeName = attribute.localName.toLowerCase();
            const value = attribute.value.trim().toLowerCase();
            if (attributeName.startsWith("on") || value.includes("javascript:")) {
                throw new Error("Le SVG contient un contenu exécutable interdit.");
            }
            if ((attributeName === "href" || attributeName === "src") && value && !value.startsWith("#")) {
                throw new Error("Le SVG contient une ressource externe interdite.");
            }
            if (attributeName === "style" && unsafeLogoStyle(value)) {
                throw new Error("Le SVG contient une feuille de style externe.");
            }
        }
        if (name === "style" && unsafeLogoStyle(element.textContent ?? "")) {
            throw new Error("Le SVG contient une feuille de style externe.");
        }
    }
}

function unsafeLogoStyle(value: string): boolean {
    value = value.toLowerCase();
    if (value.includes("javascript:") || value.includes("@import")) return true;
    for (let remaining = value; remaining.length > 0;) {
        const start = remaining.indexOf("url");
        if (start < 0) return false;
        const afterName = remaining.slice(start + 3).trimStart();
        if (!afterName.startsWith("(")) {
            remaining = afterName;
            continue;
        }
        const end = afterName.indexOf(")");
        if (end < 0) return true;
        const target = afterName.slice(1, end).trim().replace(/^['"]|['"]$/g, "");
        if (target && !target.startsWith("#")) return true;
        remaining = afterName.slice(end + 1);
    }
    return false;
}
