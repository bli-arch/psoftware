export type DateFormatCategory = "date" | "time" | "text" | "advanced";

export type DateFormatToken = {
    code: string;
    label: string;
    description: string;
    category: DateFormatCategory;
};

export type DateFormatPreset = {
    label: string;
    value: string;
};

export type DateFormatPart =
    | { type: "text"; value: string }
    | { type: "token"; token: DateFormatToken };

export const DEFAULT_DATE_FORMAT_MAX_LENGTH = 100;

export const DATE_FORMAT_CATEGORIES: ReadonlyArray<{
    id: DateFormatCategory;
    label: string;
}> = [
    { id: "date", label: "Date" },
    { id: "time", label: "Heure" },
    { id: "text", label: "Variantes de texte" },
    { id: "advanced", label: "Avancé" },
];

export const DATE_FORMAT_TOKENS: readonly DateFormatToken[] = [
    { code: "%d", label: "Jour du mois", description: "Jour sur deux chiffres", category: "date" },
    { code: "%A", label: "Jour de la semaine", description: "Nom complet du jour", category: "date" },
    { code: "%a", label: "Jour abrégé", description: "Nom abrégé du jour", category: "date" },
    { code: "%m", label: "Mois numérique", description: "Mois sur deux chiffres", category: "date" },
    { code: "%B", label: "Nom du mois", description: "Nom complet du mois", category: "date" },
    { code: "%b", label: "Mois abrégé", description: "Nom abrégé du mois", category: "date" },
    { code: "%Y", label: "Année", description: "Année sur quatre chiffres", category: "date" },
    { code: "%y", label: "Année courte", description: "Année sur deux chiffres", category: "date" },
    { code: "%H", label: "Heure (24 h)", description: "Heure sur deux chiffres", category: "time" },
    { code: "%I", label: "Heure (12 h)", description: "Heure sur deux chiffres", category: "time" },
    { code: "%M", label: "Minutes", description: "Minutes sur deux chiffres", category: "time" },
    { code: "%S", label: "Secondes", description: "Secondes sur deux chiffres", category: "time" },
    { code: "%p", label: "Période", description: "Indicateur AM ou PM", category: "time" },
    { code: "%^A", label: "Jour en majuscules", description: "Nom complet en majuscules", category: "text" },
    { code: "%_A", label: "Jour en minuscules", description: "Nom complet en minuscules", category: "text" },
    { code: "%^a", label: "Jour abrégé en majuscules", description: "Nom abrégé en majuscules", category: "text" },
    { code: "%_a", label: "Jour abrégé en minuscules", description: "Nom abrégé en minuscules", category: "text" },
    { code: "%^B", label: "Mois en majuscules", description: "Nom complet en majuscules", category: "text" },
    { code: "%_B", label: "Mois en minuscules", description: "Nom complet en minuscules", category: "text" },
    { code: "%^b", label: "Mois abrégé en majuscules", description: "Nom abrégé en majuscules", category: "text" },
    { code: "%_b", label: "Mois abrégé en minuscules", description: "Nom abrégé en minuscules", category: "text" },
    { code: "%j", label: "Jour de l’année", description: "Numéro de 001 à 366", category: "advanced" },
    { code: "%w", label: "Numéro du jour", description: "Dimanche vaut 0, samedi vaut 6", category: "advanced" },
    { code: "%U", label: "Semaine, dimanche", description: "Numéro de semaine, dimanche en premier", category: "advanced" },
    { code: "%W", label: "Semaine, lundi", description: "Numéro de semaine, lundi en premier", category: "advanced" },
    { code: "%f", label: "Microsecondes", description: "Fraction de seconde sur six chiffres", category: "advanced" },
    { code: "%x", label: "Date locale", description: "Date selon les préférences régionales", category: "advanced" },
    { code: "%X", label: "Heure locale", description: "Heure selon les préférences régionales", category: "advanced" },
    { code: "%c", label: "Date et heure locales", description: "Date et heure selon les préférences régionales", category: "advanced" },
    { code: "%Z", label: "Fuseau horaire", description: "Nom abrégé du fuseau horaire", category: "advanced" },
    { code: "%z", label: "Décalage UTC", description: "Décalage au format +HHMM", category: "advanced" },
    { code: "%s", label: "Horodatage Unix", description: "Nombre de secondes depuis 1970", category: "advanced" },
    { code: "%%", label: "Signe pourcentage", description: "Insère le caractère %", category: "advanced" },
] as const;

export const DATE_FORMAT_PRESETS: readonly DateFormatPreset[] = [
    { label: "Numérique", value: "%d/%m/%Y" },
    { label: "En toutes lettres", value: "%d %B %Y" },
    { label: "ISO 8601", value: "%Y-%m-%d" },
    { label: "Date et heure", value: "%d/%m/%Y à %H:%M" },
] as const;

const DATE_FIELD_TOKEN_CODES = [
    "%d", "%A", "%a", "%m", "%B", "%b", "%Y", "%y",
    "%^A", "%_A", "%^a", "%_a", "%^B", "%_B", "%^b", "%_b",
    "%j", "%w", "%U", "%W", "%x", "%%",
] as const;
const MONTH_FIELD_TOKEN_CODES = [
    "%m", "%B", "%b", "%Y", "%y", "%^B", "%_B", "%^b", "%_b", "%%",
] as const;
const YEAR_FIELD_TOKEN_CODES = ["%Y", "%y", "%%"] as const;

const DATE_FIELD_PRESETS: readonly DateFormatPreset[] = [
    { label: "Numérique", value: "%d/%m/%Y" },
    { label: "En toutes lettres", value: "%d %B %Y" },
    { label: "ISO 8601", value: "%Y-%m-%d" },
] as const;
const MONTH_FIELD_PRESETS: readonly DateFormatPreset[] = [
    { label: "Mois et année", value: "%B %Y" },
    { label: "Numérique", value: "%m/%Y" },
    { label: "ISO 8601", value: "%Y-%m" },
] as const;
const YEAR_FIELD_PRESETS: readonly DateFormatPreset[] = [
    { label: "Année", value: "%Y" },
    { label: "Année courte", value: "%y" },
] as const;

export function dateFieldFormatTokenCodes(mode: unknown): readonly string[] {
    if (mode === "year") return YEAR_FIELD_TOKEN_CODES;
    if (mode === "month") return MONTH_FIELD_TOKEN_CODES;
    return DATE_FIELD_TOKEN_CODES;
}

export function dateFieldFormatPresets(mode: unknown): readonly DateFormatPreset[] {
    if (mode === "year") return YEAR_FIELD_PRESETS;
    if (mode === "month") return MONTH_FIELD_PRESETS;
    return DATE_FIELD_PRESETS;
}

export const IDENTIFIER_DATE_FORMAT_TOKEN_CODES = [
    "%a", "%A", "%w", "%d", "%b", "%B", "%m", "%y",
    "%Y", "%H", "%I", "%M", "%S", "%%",
] as const;

export const IDENTIFIER_DATE_FORMAT_PRESETS: readonly DateFormatPreset[] = [
    { label: "Compact", value: "%Y%m%d" },
    { label: "Année courte", value: "%y%m%d" },
    { label: "Jour en premier", value: "%d%m%Y" },
] as const;

const tokenByCode = new Map(DATE_FORMAT_TOKENS.map((token) => [token.code, token]));
const tokenCodes = [...tokenByCode.keys()].sort((left, right) => right.length - left.length);

export function dateFormatToken(code: string) {
    return tokenByCode.get(code);
}

export function parseDateFormat(format: string): DateFormatPart[] {
    const parts: DateFormatPart[] = [];
    let text = "";
    let index = 0;

    while (index < format.length) {
        const code = tokenCodes.find((candidate) => format.startsWith(candidate, index));
        if (!code) {
            text += format[index];
            index += 1;
            continue;
        }
        if (code === "%%") {
            text += code;
            index += code.length;
            continue;
        }

        if (text) {
            parts.push({ type: "text", value: text });
            text = "";
        }

        parts.push({ type: "token", token: tokenByCode.get(code)! });
        index += code.length;
    }

    if (text) parts.push({ type: "text", value: text });
    return parts;
}

export function validateDateFormat(
    format: string | null | undefined,
    options: {
        required?: boolean;
        maxLength?: number;
        allowedTokenCodes?: readonly string[];
        allowLiteralPercent?: boolean;
    } = {},
): string | null {
    const value = format ?? "";
    const maxLength = options.maxLength ?? DEFAULT_DATE_FORMAT_MAX_LENGTH;

    if (!value) return options.required ? "Le format est requis." : null;
    if (Array.from(value).length > maxLength) {
        return `Le format ne peut pas dépasser ${maxLength} caractères.`;
    }

    const allowed = options.allowedTokenCodes ? new Set(options.allowedTokenCodes) : null;
    for (let index = 0; index < value.length; index += 1) {
        if (value[index] !== "%") continue;

        const code = tokenCodes.find((candidate) => value.startsWith(candidate, index));
        if (!code) {
            if (options.allowLiteralPercent) continue;
            if (index === value.length - 1) return "Le signe « % » doit être complété.";
            const modifierLength = value[index + 1] === "^" || value[index + 1] === "_" ? 2 : 1;
            const directive = value.slice(index, Math.min(value.length, index + modifierLength + 1));
            return `La directive « ${directive} » n’est pas reconnue.`;
        }
        if (allowed && !allowed.has(code)) {
            return `La directive « ${code} » n’est pas disponible ici.`;
        }

        index += code.length - 1;
    }

    return null;
}

export function filterDateFormatTokens(
    query: string,
    allowedTokenCodes?: readonly string[],
) {
    const allowed = allowedTokenCodes ? new Set(allowedTokenCodes) : null;
    const normalizedQuery = query.trim().toLocaleLowerCase("fr-FR");

    return DATE_FORMAT_TOKENS.filter((token) => {
        if (token.code === "%%") return false;
        if (allowed && !allowed.has(token.code)) return false;
        if (!normalizedQuery) return true;

        return `${token.code} ${token.label} ${token.description}`
            .toLocaleLowerCase("fr-FR")
            .includes(normalizedQuery);
    });
}
