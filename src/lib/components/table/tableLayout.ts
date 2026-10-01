import type { UiPreferences } from "$lib/uiPreferences";

export const TABLE_ROW_HEIGHT_CLASSES: Record<UiPreferences["density"], string> = {
    compact: "h-8 min-h-8",
    standard: "h-9 min-h-9",
    comfortable: "h-10 min-h-10",
};

export const pageRangeStart = (count: number, index: number, size: number) =>
    count === 0 ? 0 : index * size + 1;

export const pageRangeEnd = (count: number, index: number, size: number) =>
    count === 0 ? 0 : Math.min((index + 1) * size, count);

export function visiblePages(current: number, total: number) {
    if (total <= 7) return Array.from({ length: total }, (_, index) => index);

    const pages = new Set([0, total - 1, current - 1, current, current + 1]);
    if (current <= 2) [1, 2, 3].forEach((page) => pages.add(page));
    if (current >= total - 3) [total - 4, total - 3, total - 2].forEach((page) => pages.add(page));

    return Array.from(pages)
        .filter((page) => page >= 0 && page < total)
        .sort((left, right) => left - right);
}
