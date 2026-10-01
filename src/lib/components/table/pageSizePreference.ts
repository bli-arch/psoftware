export const TABLE_PAGE_SIZE_OPTIONS = [10, 15, 25, 50] as const;

export const TABLE_PAGE_SIZE_SELECT_OPTIONS = TABLE_PAGE_SIZE_OPTIONS.map((value) => ({
    label: String(value),
    value,
}));

export type TablePageSizeScope = "clients" | "operations" | "team";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const DEFAULT_PAGE_SIZE = 15;
const storageKey = (scope: TablePageSizeScope) => `psoftware.table.${scope}.page-size.v1`;

const availableStorage = (): StorageLike | undefined =>
    typeof localStorage === "undefined" ? undefined : localStorage;

export function normalizeTablePageSize(value: unknown, fallback = DEFAULT_PAGE_SIZE): number {
    const numericValue = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
    if (TABLE_PAGE_SIZE_OPTIONS.includes(numericValue as (typeof TABLE_PAGE_SIZE_OPTIONS)[number])) {
        return numericValue as number;
    }
    return TABLE_PAGE_SIZE_OPTIONS.includes(fallback as (typeof TABLE_PAGE_SIZE_OPTIONS)[number])
        ? fallback
        : DEFAULT_PAGE_SIZE;
}

export function readTablePageSize(
    scope: TablePageSizeScope,
    fallback = DEFAULT_PAGE_SIZE,
    storage = availableStorage(),
): number {
    const safeFallback = normalizeTablePageSize(fallback);
    if (!storage) return safeFallback;

    try {
        return normalizeTablePageSize(storage.getItem(storageKey(scope)), safeFallback);
    } catch {
        return safeFallback;
    }
}

export function persistTablePageSize(
    scope: TablePageSizeScope,
    value: unknown,
    storage = availableStorage(),
): boolean {
    if (!storage) return false;
    const pageSize = normalizeTablePageSize(value, 0);
    if (pageSize !== value) return false;

    try {
        storage.setItem(storageKey(scope), String(pageSize));
        return true;
    } catch {
        return false;
    }
}
