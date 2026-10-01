import { strftime } from "$lib/utils";

export type IdentifierTokenType = "text" | "sequence" | "today" | "date" | "randomChars" | "randomLetters" | "randomNumbers";
export type IdentifierCaseMode = "mixed" | "lower" | "upper";

export type IdentifierPart = {
    id: string;
    type: IdentifierTokenType;
    value?: string;
    length?: number;
    format?: string;
    caseMode?: IdentifierCaseMode;
    compactLength?: boolean;
};

export type IdentifierPreviewOptions = {
    nextId?: number;
    todayCount?: number;
    date?: Date;
};

export const DEFAULT_IDENTIFIER_PREVIEW_OPTIONS = {
    nextId: 42,
    todayCount: 7,
} as const satisfies IdentifierPreviewOptions;

export const MAX_IDENTIFIER_LENGTH = 50;
export const MAX_IDENTIFIER_PART_LENGTH = MAX_IDENTIFIER_LENGTH;
export const MAX_IDENTIFIER_TEMPLATE_LENGTH = 512;

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const NUMBERS = "0123456789";

const formatLength = (length = 1, compactLength = true) => {
    const safeLength = Number.isFinite(length) && length > 0 ? Math.min(MAX_IDENTIFIER_PART_LENGTH, Math.floor(length)) : 1;
    return compactLength && safeLength === 1 ? "" : String(safeLength);
};

const makeId = () => crypto.randomUUID();

export const createIdentifierPart = (type: IdentifierTokenType): IdentifierPart => {
    const base = { id: makeId(), type, compactLength: true };

    if (type === "text") return { ...base, value: "OP-" };
    if (type === "sequence") return { ...base, length: 4 };
    if (type === "today") return { ...base, length: 2 };
    if (type === "date") return { ...base, format: "%Y%m%d" };
    if (type === "randomChars") return { ...base, length: 4, caseMode: "mixed" };
    if (type === "randomLetters") return { ...base, length: 3, caseMode: "upper" };
    return { ...base, length: 3 };
};

export const serializeIdentifierPart = (part: IdentifierPart): string => {
    if (part.type === "text") return part.value ?? "";
    if (part.type === "date") return `%D<${part.format || "Ymd"}>%`;

    const length = formatLength(part.length, part.compactLength);
    if (part.type === "sequence") return `%${length}N%`;
    if (part.type === "today") return `%${length}Ntod%`;
    if (part.type === "randomNumbers") return `%${length}Rn%`;

    const modifier = part.caseMode === "lower" ? "_" : part.caseMode === "upper" ? "^" : "";
    if (part.type === "randomLetters") return `%${length}${modifier}Rl%`;
    return `%${length}${modifier}R%`;
};

export const serializeIdentifierParts = (parts: IdentifierPart[]): string =>
    parts.map(serializeIdentifierPart).join("");

const parseTag = (tag: string): IdentifierPart | null => {
    let match = tag.match(/^(\d*)N$/);
    if (match) return { id: makeId(), type: "sequence", length: Number(match[1] || 1), compactLength: !match[1] };

    match = tag.match(/^(\d*)Ntod$/);
    if (match) return { id: makeId(), type: "today", length: Number(match[1] || 1), compactLength: !match[1] };

    match = tag.match(/^D<(.+)>$/);
    if (match) return { id: makeId(), type: "date", format: match[1] || "Ymd", compactLength: true };

    match = tag.match(/^(\d*)([_^]?)Rl$/);
    if (match) {
        return {
            id: makeId(),
            type: "randomLetters",
            length: Number(match[1] || 1),
            caseMode: match[2] === "_" ? "lower" : match[2] === "^" ? "upper" : "mixed",
            compactLength: !match[1]
        };
    }

    match = tag.match(/^(\d*)Rn$/);
    if (match) return { id: makeId(), type: "randomNumbers", length: Number(match[1] || 1), compactLength: !match[1] };

    match = tag.match(/^(\d*)([_^]?)R$/);
    if (match) {
        return {
            id: makeId(),
            type: "randomChars",
            length: Number(match[1] || 1),
            caseMode: match[2] === "_" ? "lower" : match[2] === "^" ? "upper" : "mixed",
            compactLength: !match[1]
        };
    }

    return null;
};

export const parseIdentifierTemplate = (template = ""): IdentifierPart[] => {
    const parts: IdentifierPart[] = [];
    let cursor = 0;

    while (cursor < template.length) {
        const start = template.indexOf("%", cursor);
        if (start < 0) {
            parts.push({ id: makeId(), type: "text", value: template.slice(cursor) });
            break;
        }

        if (start > cursor) {
            parts.push({ id: makeId(), type: "text", value: template.slice(cursor, start) });
        }

        const end = template.startsWith("%D<", start)
            ? template.indexOf(">%", start + 3)
            : template.indexOf("%", start + 1);

        if (end < 0) {
            parts.push({ id: makeId(), type: "text", value: template.slice(start) });
            break;
        }

        const raw = template.slice(start, end + (template.startsWith("%D<", start) ? 2 : 1));
        const parsed = parseTag(raw.slice(1, -1));
        parts.push(parsed ?? { id: makeId(), type: "text", value: raw });
        cursor = start + raw.length;
    }

    return parts.length ? parts : [createIdentifierPart("text"), createIdentifierPart("date"), createIdentifierPart("sequence")];
};

const maxDateOutputLength = (format: string) => {
    const lengths: Record<string, number> = { a: 4, A: 8, w: 1, d: 2, b: 5, B: 9, m: 2, y: 2, Y: 4, H: 2, I: 2, M: 2, S: 2, "%": 1 };
    if (!format.includes("%")) return Array.from(format).reduce((length, character) => length + (lengths[character] ?? 1), 0);

    let length = 0;
    for (let index = 0; index < format.length; index += 1) {
        if (format[index] !== "%") {
            length += 1;
            continue;
        }
        index += 1;
        if (index >= format.length || lengths[format[index]] === undefined) return null;
        length += lengths[format[index]];
    }
    return length;
};

export const validateIdentifierTemplate = (template: string): string | null => {
    if (!template) return "Le format ne peut pas être vide.";
    if (Array.from(template).length > MAX_IDENTIFIER_TEMPLATE_LENGTH) return `Le format dépasse ${MAX_IDENTIFIER_TEMPLATE_LENGTH} caractères.`;

    let outputLength = 0;
    let hasCollisionVariant = false;
    let hasDailySequence = false;
    let hasFullDate = false;
    let cursor = 0;
    while (cursor < template.length) {
        const start = template.indexOf("%", cursor);
        if (start < 0) {
            outputLength += Array.from(template.slice(cursor)).length;
            break;
        }
        outputLength += Array.from(template.slice(cursor, start)).length;

        if (template.startsWith("%D<", start)) {
            const end = template.indexOf(">%", start + 3);
            if (end < 0) return "La balise de date n’est pas terminée.";
            const format = template.slice(start + 3, end);
            if (!format) return "Le format de date ne peut pas être vide.";
            if (Array.from(format).length > MAX_IDENTIFIER_PART_LENGTH) return `Le format de date dépasse ${MAX_IDENTIFIER_PART_LENGTH} caractères.`;
            const dateLength = maxDateOutputLength(format);
            if (dateLength === null) return "Le format de date contient une directive inconnue.";
            hasFullDate ||= hasDayMonthYearDate(format);
            outputLength += dateLength;
            cursor = end + 2;
        } else {
            const end = template.indexOf("%", start + 1);
            if (end < 0) return "La balise n’est pas terminée.";
            const tag = template.slice(start + 1, end);
            const match = tag.match(/^(\d*)(?:N|Ntod|Rn|[_^]?(?:R|Rl))$/);
            if (!match) return `Balise inconnue « %${tag}% ».`;
            const token = tag.slice(match[1].length).replace(/^[_^]/, "");
            hasCollisionVariant ||= token === "N" || token === "R" || token === "Rl" || token === "Rn";
            hasDailySequence ||= token === "Ntod";
            const width = Number(match[1] || 1);
            if (!Number.isInteger(width) || width < 1 || width > MAX_IDENTIFIER_PART_LENGTH) {
                return `La longueur d’une balise doit être comprise entre 1 et ${MAX_IDENTIFIER_PART_LENGTH}.`;
            }
            outputLength += width;
            cursor = end + 1;
        }
        if (outputLength > MAX_IDENTIFIER_LENGTH) return `L’identifiant généré dépasserait ${MAX_IDENTIFIER_LENGTH} caractères.`;
    }
    if (!hasCollisionVariant && !(hasDailySequence && hasFullDate)) {
        return "Le format doit contenir une séquence globale, une valeur aléatoire ou un compteur quotidien accompagné d’une date complète.";
    }
    return outputLength > MAX_IDENTIFIER_LENGTH ? `L’identifiant généré dépasserait ${MAX_IDENTIFIER_LENGTH} caractères.` : null;
};

const padNumber = (value: number, length = 1) => String(value).padStart(Math.min(MAX_IDENTIFIER_PART_LENGTH, Math.max(1, Math.floor(length))), "0");

const randomInt = (max: number) => {
    if (globalThis.crypto?.getRandomValues) {
        const value = new Uint32Array(1);
        const limit = Math.floor(0x1_0000_0000 / max) * max;
        do globalThis.crypto.getRandomValues(value);
        while (value[0] >= limit);
        return value[0] % max;
    }
    return Math.floor(Math.random() * max);
};

const pickChars = (chars: string, length = 1) =>
    Array.from({ length: Math.min(MAX_IDENTIFIER_PART_LENGTH, Math.max(1, Math.floor(length))) }, () => chars[randomInt(chars.length)]).join("");

const applyCaseMode = (mode: IdentifierCaseMode | undefined, mixedChars: string) => {
    if (mode === "lower") return LOWERCASE;
    if (mode === "upper") return UPPERCASE;
    return mixedChars;
};

export const formatIdentifierDate = (format: string, date = new Date()) => {
    const tokens: Record<string, string> = {
        a: "%_a",
        A: "%_A",
        b: "%_b",
        B: "%_B",
        w: "%w",
        d: "%d",
        m: "%m",
        y: "%y",
        Y: "%Y",
        H: "%H",
        I: "%I",
        M: "%M",
        S: "%S",
    };
    const strftimeFormat = format.includes("%")
        ? format.replace(/%([aAbBdwymYHIMS%])/g, (match, key: string) =>
            key === "%" ? "%%" : tokens[key] ?? match)
        : Array.from(format || "Ymd", (char) => tokens[char] ?? char).join("");

    return strftime(date, strftimeFormat, "fr-FR");
};

export const previewIdentifierParts = (parts: IdentifierPart[], options: IdentifierPreviewOptions = {}) => {
    const nextId = options.nextId ?? 1;
    const todayCount = options.todayCount ?? 0;
    const date = options.date ?? new Date();

    return parts.map((part) => {
        if (part.type === "text") return part.value ?? "";
        if (part.type === "sequence") return padNumber(nextId, part.length);
        if (part.type === "today") return padNumber(todayCount + 1, part.length);
        if (part.type === "date") return formatIdentifierDate(part.format || "Ymd", date);
        if (part.type === "randomNumbers") return pickChars(NUMBERS, part.length);
        if (part.type === "randomLetters") return pickChars(applyCaseMode(part.caseMode, LETTERS), part.length);
        return pickChars(applyCaseMode(part.caseMode, `${LETTERS}${NUMBERS}`), part.length);
    }).join("").slice(0, MAX_IDENTIFIER_LENGTH);
};

export const estimateIdentifierEntropyBits = (parts: IdentifierPart[]) => {
    let hasSequence = false;
    let hasToday = false;

    return parts.reduce((bits, part) => {
        const length = Math.min(MAX_IDENTIFIER_PART_LENGTH, Math.max(1, Math.floor(part.length ?? 1)));

        if (part.type === "sequence") {
            if (hasSequence) return bits;
            hasSequence = true;
            return bits + Math.log2(NUMBERS.length);
        }

        if (part.type === "today") {
            if (hasToday) return bits;
            hasToday = true;
            return bits + Math.log2(NUMBERS.length);
        }

        if (part.type === "randomNumbers") return bits + length * Math.log2(NUMBERS.length);
        if (part.type === "randomLetters") return bits + length * Math.log2(part.caseMode === "mixed" ? LETTERS.length : LOWERCASE.length);
        if (part.type === "randomChars") return bits + length * Math.log2(part.caseMode === "mixed" ? LETTERS.length + NUMBERS.length : LOWERCASE.length);
        return bits;
    }, 0);
};

const hasDayMonthYearDate = (format = "Ymd") => {
    const tokens = format.includes("%")
        ? Array.from(format.matchAll(/%([aAbBdwymYHIMS%])/g), (match) => match[1])
        : Array.from(format);

    return tokens.some((token) => token === "d")
        && tokens.some((token) => token === "m" || token === "b" || token === "B")
        && tokens.some((token) => token === "y" || token === "Y");
};

export const estimateIdentifierCollisionCount = (parts: IdentifierPart[]) => {
    if (parts.some((part) => part.type === "sequence")) return Infinity;
    if (parts.some((part) => part.type === "today") && parts.some((part) => part.type === "date" && hasDayMonthYearDate(part.format))) return Infinity;

    const randomBits = parts.reduce((bits, part) => {
        const length = Math.min(MAX_IDENTIFIER_PART_LENGTH, Math.max(1, Math.floor(part.length ?? 1)));

        if (part.type === "randomNumbers") return bits + length * Math.log2(NUMBERS.length);
        if (part.type === "randomLetters") return bits + length * Math.log2(part.caseMode === "mixed" ? LETTERS.length : LOWERCASE.length);
        if (part.type === "randomChars") return bits + length * Math.log2(part.caseMode === "mixed" ? LETTERS.length + NUMBERS.length : LOWERCASE.length);
        return bits;
    }, 0);

    if (!randomBits) return 1;
    if (randomBits > 1023) return Infinity;

    return Math.max(1, Math.floor(Math.sqrt(2 * 2 ** randomBits * Math.log(2))));
};
