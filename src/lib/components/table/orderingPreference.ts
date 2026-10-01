import type { TablePageSizeScope } from "./pageSizePreference";

export type TableSortKey = {
    id: string;
    order: "asc" | "desc";
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const storageKey = (scope: TablePageSizeScope) => `psoftware.table.${scope}.ordering.v1`;

const availableStorage = (): StorageLike | undefined =>
    typeof localStorage === "undefined" ? undefined : localStorage;

export function normalizeTableOrdering(
    value: unknown,
    sortableColumnIds: readonly (string | number)[],
): TableSortKey | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;

    const { id, order } = value as Partial<TableSortKey>;
    const normalizedId = typeof id === "string" || typeof id === "number" ? String(id) : "";
    const validIds = new Set(sortableColumnIds.map(String));

    if (!validIds.has(normalizedId) || (order !== "asc" && order !== "desc")) return null;
    return { id: normalizedId, order };
}

export function readTableOrdering(
    scope: TablePageSizeScope,
    sortableColumnIds: readonly (string | number)[],
    storage: StorageLike | undefined = availableStorage(),
): TableSortKey | null {
    if (!storage) return null;

    try {
        const stored = storage.getItem(storageKey(scope));
        return stored ? normalizeTableOrdering(JSON.parse(stored), sortableColumnIds) : null;
    } catch {
        return null;
    }
}

export function persistTableOrdering(
    scope: TablePageSizeScope,
    ordering: TableSortKey | null,
    sortableColumnIds: readonly (string | number)[],
    storage: StorageLike | undefined = availableStorage(),
): boolean {
    if (!storage) return false;

    try {
        if (ordering === null) {
            storage.removeItem(storageKey(scope));
            return true;
        }

        const normalized = normalizeTableOrdering(ordering, sortableColumnIds);
        if (!normalized) return false;
        storage.setItem(storageKey(scope), JSON.stringify(normalized));
        return true;
    } catch {
        return false;
    }
}
