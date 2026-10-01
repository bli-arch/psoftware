import { apiGet } from '$lib/api';
import { setupDataTable } from '$lib/components/table/createTable';
import type { TableSortKey } from '$lib/components/table/orderingPreference';
import { normalizeFormConfig, normalizePageSize, normalizeTableSettings, recordList, recordOrEmpty } from '$lib/formConfig';
import { writable } from 'svelte/store';

export interface Operation {
    uid: string;
    [key: string]: any;
}

const baseOrderingMap: Record<string, string> = {
    uid: 'uid',
    created_at: 'created_at',
    state: 'state',
    'state.name': 'state.name',
    'client.uid': 'client.uid',
    'creator.username': 'creator.username'
};

export const serverItemCount = writable(0);
export const isLoading = writable(false);

let states: Array<Record<string, any>> = [];
let form: any = null;
let tableSettingsCache: any[] = [];
let pageSizeCache = 15;

const normalizeOperationRows = (rows: unknown) =>
    (recordList(rows) as Operation[]).map((operation) => ({
        ...operation,
        operation: recordOrEmpty(operation.data),
    }));

export async function loadOperationConfig(force = false) {
    if (form && !force) {
        return {
            states,
            form,
            tableSettings: tableSettingsCache,
            pageSize: pageSizeCache
        };
    }

    const [statesRes, formRes] = await Promise.all([
        apiGet(`/settings/state/`),
        apiGet(`/settings/form/active/operation`).catch((error: unknown) => {
            if (error && typeof error === 'object' && 'status' in error && error.status === 404) return null;
            throw error;
        })
    ]);

    states = recordList(statesRes);
    form = normalizeFormConfig(formRes);
    pageSizeCache = normalizePageSize(form?.settings.pageSize);
    tableSettingsCache = normalizeTableSettings(form?.settings.tableSettings);

    return {
        states,
        form,
        tableSettings: tableSettingsCache,
        pageSize: pageSizeCache
    };
}

export function getTableSettings() {
    return tableSettingsCache;
}

export function getPageSize() {
    return pageSizeCache;
}

export function getStates() {
    return states;
}

export async function getOperations(
    page: number = 1,
    limit?: number,
    query: Record<string, unknown> | string = ''
) {
    if (!form) await loadOperationConfig();

    const effectiveLimit = limit ?? pageSizeCache;
    isLoading.set(true);

    try {
        const params = new URLSearchParams({
            limit: String(effectiveLimit),
            offset: String((page - 1) * effectiveLimit)
        });

        if (typeof query === 'string') {
            if (query) params.set('search', query);
        } else if (query && typeof query === 'object') {
            Object.entries(query).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                    value.forEach((item) => {
                        if (item !== undefined && item !== '') params.append(key, String(item));
                    });
                    return;
                }

                if (value !== undefined && value !== '') params.set(key, String(value));
            });
        }

        const data = await apiGet(`/core/operations/?${params.toString()}`);
        const rows = normalizeOperationRows(data);
        serverItemCount.set(typeof data?.count === 'number' && data.count >= 0 ? data.count : rows.length);
        return rows;
    } catch (error) {
        console.error(error);
        return [];
    } finally {
        isLoading.set(false);
    }
}

export function setupTable(
    initialData: Operation[],
    columnWidths: Record<string, number> = {},
    pageSize = pageSizeCache,
    initialSortKeys: TableSortKey[] = [],
) {
    const orderingMap = tableSettingsCache.reduce<Record<string, string>>((map, setting) => {
        if (typeof setting.dataOrigin === 'string') map[setting.dataOrigin] = setting.dataOrigin;
        return map;
    }, { ...baseOrderingMap });

    return setupDataTable<Operation>({
        initialData,
        tableSettings: tableSettingsCache,
        pageSize,
        serverItemCount,
        columnWidths,
        orderingMap,
        form,
        states,
        initialSortKeys
    });
}
