import { strftime } from "$lib/utils";

export type DateMode = "date" | "month" | "year" | "time" | "time-ms";
export type TimePart = "hours" | "minutes" | "seconds";

const DATE_MODES = new Set<DateMode>(["date", "month", "year", "time", "time-ms"]);
const pad = (value: number) => String(value).padStart(2, "0");
const padYear = (value: number) => String(value).padStart(4, "0");

export function normalizeDateMode(value: unknown): DateMode {
    return typeof value === "string" && DATE_MODES.has(value as DateMode)
        ? value as DateMode
        : "date";
}

function validDate(year: number, month: number, day: number) {
    const date = new Date(0);
    date.setHours(0, 0, 0, 0);
    date.setFullYear(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function dateParts(value: Date) {
    return {
        year: value.getFullYear(),
        month: value.getMonth() + 1,
        day: value.getDate(),
        hours: value.getHours(),
        minutes: value.getMinutes(),
        seconds: value.getSeconds(),
    };
}

export function normalizeDateValue(
    value: unknown,
    mode: DateMode,
    showSeconds = false,
): string | null {
    if (value === null || value === undefined || value === "") return null;

    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return null;
        const parts = dateParts(value);

        if (mode === "year") return padYear(parts.year);
        if (mode === "month") return `${padYear(parts.year)}-${pad(parts.month)}`;
        if (mode === "date") return `${padYear(parts.year)}-${pad(parts.month)}-${pad(parts.day)}`;
        if (mode === "time-ms") return `${parts.minutes}:${pad(parts.seconds)}`;
        return `${pad(parts.hours)}:${pad(parts.minutes)}${showSeconds ? `:${pad(parts.seconds)}` : ""}`;
    }

    const raw = String(value).trim();
    if (!raw) return null;

    if (mode === "date") {
        const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
        if (!match) return null;
        const [, year, month, day] = match.map(Number);
        return year >= 1 && validDate(year, month, day)
            ? `${match[1]}-${pad(month)}-${pad(day)}`
            : null;
    }

    if (mode === "month") {
        const match = raw.match(/^(\d{4})-(\d{2})(?:-\d{2})?(?:T.*)?$/);
        if (!match) return null;
        const year = Number(match[1]);
        const month = Number(match[2]);
        return year > 0 && month >= 1 && month <= 12 ? `${match[1]}-${pad(month)}` : null;
    }

    if (mode === "year") {
        const match = raw.match(/^(\d{1,4})(?:-\d{2}(?:-\d{2})?)?(?:T.*)?$/);
        const year = Number(match?.[1]);
        return year >= 1 && year <= 9999 ? padYear(year) : null;
    }

    if (mode === "time-ms") {
        const time = raw.includes("T") ? raw.split("T")[1] : raw;
        const match = time.match(/^(?:\d{1,2}:)?(\d{1,4}):(\d{1,2})$/);
        if (!match) return null;
        const minutes = Number(match[1]);
        const seconds = Number(match[2]);
        return minutes <= 59 && seconds <= 59 ? `${minutes}:${pad(seconds)}` : null;
    }

    const time = raw.includes("T") ? raw.split("T")[1] : raw;
    const match = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/);
    if (!match) return null;

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3] ?? 0);
    if (hours > 23 || minutes > 59 || seconds > 59) return null;
    return `${pad(hours)}:${pad(minutes)}${showSeconds ? `:${pad(seconds)}` : ""}`;
}

function comparableValue(value: string, mode: DateMode) {
    if (mode === "time-ms") {
        const [minutes, seconds] = value.split(":").map(Number);
        return minutes * 60 + seconds;
    }

    return Number(value.replaceAll("-", "").replaceAll(":", ""));
}

export function normalizeDateBounds(
    min: unknown,
    max: unknown,
    mode: DateMode,
    showSeconds = false,
): [string | null, string | null] {
    const normalizedMin = normalizeDateValue(min, mode, showSeconds);
    const normalizedMax = normalizeDateValue(max, mode, showSeconds);

    if (
        normalizedMin !== null
        && normalizedMax !== null
        && comparableValue(normalizedMin, mode) > comparableValue(normalizedMax, mode)
    ) {
        return [normalizedMax, normalizedMin];
    }

    return [normalizedMin, normalizedMax];
}

export function clampDateValue(
    value: unknown,
    min: unknown,
    max: unknown,
    mode: DateMode,
    showSeconds = false,
) {
    const normalized = normalizeDateValue(value, mode, showSeconds);
    if (normalized === null) return null;

    const [normalizedMin, normalizedMax] = normalizeDateBounds(min, max, mode, showSeconds);
    const comparable = comparableValue(normalized, mode);

    if (normalizedMin !== null && comparable < comparableValue(normalizedMin, mode)) return normalizedMin;
    if (normalizedMax !== null && comparable > comparableValue(normalizedMax, mode)) return normalizedMax;
    return normalized;
}

export function replaceTimePart(
    value: unknown,
    mode: Extract<DateMode, "time" | "time-ms">,
    part: TimePart,
    nextPart: number,
    showSeconds = false,
) {
    const normalized = normalizeDateValue(value, mode, showSeconds);
    if (!normalized || !Number.isInteger(nextPart)) return null;

    const parts = normalized.split(":").map(Number);
    const current = mode === "time-ms"
        ? { hours: 0, minutes: parts[0], seconds: parts[1] }
        : { hours: parts[0], minutes: parts[1], seconds: parts[2] ?? 0 };
    const limit = part === "hours" ? 23 : 59;
    if (nextPart < 0 || nextPart > limit || (mode === "time-ms" && part === "hours")) return null;

    const updated = { ...current, [part]: nextPart };
    return mode === "time-ms"
        ? `${updated.minutes}:${pad(updated.seconds)}`
        : `${pad(updated.hours)}:${pad(updated.minutes)}${showSeconds ? `:${pad(updated.seconds)}` : ""}`;
}

export function resolveTimePartSelection(
    value: unknown,
    mode: Extract<DateMode, "time" | "time-ms">,
    part: TimePart,
    nextPart: number,
    min: unknown,
    max: unknown,
    showSeconds = false,
) {
    const candidate = replaceTimePart(value, mode, part, nextPart, showSeconds);
    if (candidate === null) return null;

    const clamped = clampDateValue(candidate, min, max, mode, showSeconds);
    if (clamped === null) return null;

    const parts = clamped.split(":").map(Number);
    const selectedPart = mode === "time-ms"
        ? (part === "minutes" ? parts[0] : parts[1])
        : parts[part === "hours" ? 0 : part === "minutes" ? 1 : 2] ?? 0;

    return selectedPart === nextPart ? clamped : null;
}

export function formatDateValue(value: string | null, mode: DateMode) {
    if (!value) return "";
    if (mode === "year" || mode === "time") return value;

    if (mode === "time-ms") {
        const [minutes, seconds] = value.split(":").map(Number);
        return `${minutes} min ${pad(seconds)} s`;
    }

    return strftime(
        value,
        mode === "month" ? "%_B %Y" : "%_A %d %_b %Y",
        "fr-FR",
    );
}
