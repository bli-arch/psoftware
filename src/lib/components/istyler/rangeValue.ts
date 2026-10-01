export type RangeValue =
    | number
    | string
    | null
    | undefined
    | unknown[]
    | { min?: unknown; max?: unknown };

export function finiteRangeNumber(value: unknown, fallback: number): number {
    if (value === null || value === undefined || (typeof value === "string" && !value.trim())) {
        return fallback;
    }

    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

export function normalizeRangeBounds(min: unknown, max: unknown): [number, number] {
    const first = finiteRangeNumber(min, 0);
    const second = finiteRangeNumber(max, 100);
    return first <= second ? [first, second] : [second, first];
}

export function normalizeRangeStep(step: unknown): number {
    const value = finiteRangeNumber(step, 1);
    return value > 0 ? value : 1;
}

export function clampRangeNumber(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export function readSingleRangeValue(value: RangeValue, min: number, max: number): number {
    let candidate: unknown = value;

    if (Array.isArray(value)) candidate = value[0];
    else if (value && typeof value === "object") candidate = value.min;

    return clampRangeNumber(finiteRangeNumber(candidate, min), min, max);
}

export function readIntervalRangeValue(value: RangeValue, min: number, max: number): [number, number] {
    let start: unknown = min;
    let end: unknown = max;

    if (Array.isArray(value)) {
        [start, end] = value;
    } else if (value && typeof value === "object") {
        start = value.min;
        end = value.max;
    } else if (value !== null && value !== undefined && value !== "") {
        end = value;
    }

    const first = clampRangeNumber(finiteRangeNumber(start, min), min, max);
    const second = clampRangeNumber(finiteRangeNumber(end, max), min, max);
    return first <= second ? [first, second] : [second, first];
}
