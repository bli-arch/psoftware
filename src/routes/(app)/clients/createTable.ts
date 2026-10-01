import { apiGet } from "$lib/api";
import { setupDataTable } from "$lib/components/table/createTable";
import type { TableSortKey } from "$lib/components/table/orderingPreference";
import {
    normalizeFormConfig,
    normalizePageSize,
    normalizeTableSettings,
    isRecord,
    recordList,
    recordOrEmpty,
} from "$lib/formConfig";
import { writable } from "svelte/store";

export interface Client {
    uid: string;
    [key: string]: any;
}

const baseOrderingMap: Record<string, string> = {
    uid: "uid",
    created_at: "created_at",
    "creator.username": "creator.username",
};

export const serverItemCount = writable(0);
export const isLoading = writable(false);

let form: any = null;
let tableSettingsCache: any[] = [];
let pageSizeCache = 15;

const getPages = () => recordList(form?.form?.pages ?? form?.pages);

const getFieldConfig = (field: any) =>
    isRecord(field?.config)
        ? field.config
        : isRecord(field?.props)
            ? field.props
            : recordOrEmpty(field);

const defaultTableSettings = () => {
    const fields = getPages()
        .flatMap((page: any) => recordList(Array.isArray(page?.formFields) ? page.formFields : page?.items))
        .map(getFieldConfig)
        .filter((config: any) => config?.name)
        .slice(0, 3);

    return [
        { id: 1, title: "Identifiant", dataOrigin: "uid", display: "identifier" },
        ...fields.map((config: any, index: number) => ({
            id: index + 2,
            title: config.label ?? config.name,
            dataOrigin: `client.${config.name}`,
            display: config.type === "date" ? "date" : "text",
            format: config.type === "date" ? (config.format || "%d/%m/%Y") : undefined,
        })),
        { id: fields.length + 2, title: "Créé le", dataOrigin: "created_at", display: "date", format: "%d/%m/%Y" },
    ];
};

const normalizeClientRows = (rows: unknown) =>
    (recordList(rows) as Client[]).map((client) => ({
        ...client,
        client: recordOrEmpty(client.data),
    }));

export async function loadClientConfig(force = false) {
    if (form && !force) {
        return {
            form,
            tableSettings: tableSettingsCache,
            pageSize: pageSizeCache,
        };
    }

    const formResponse = await apiGet("/settings/form/active/client").catch((error: unknown) => {
        if (error && typeof error === "object" && "status" in error && error.status === 404) return null;
        throw error;
    });
    form = normalizeFormConfig(formResponse);
    pageSizeCache = normalizePageSize(form?.settings.pageSize);
    const configured = normalizeTableSettings(form?.settings.tableSettings);
    tableSettingsCache = configured.length ? configured : normalizeTableSettings(defaultTableSettings());

    return {
        form,
        tableSettings: tableSettingsCache,
        pageSize: pageSizeCache,
    };
}

export async function getClients(
    page: number = 1,
    limit?: number,
    query: Record<string, unknown> | string = "",
) {
    if (!form) await loadClientConfig();

    const effectiveLimit = limit ?? pageSizeCache;
    isLoading.set(true);

    try {
        const params = new URLSearchParams({
            limit: String(effectiveLimit),
            offset: String((page - 1) * effectiveLimit),
        });

        if (typeof query === "string") {
            if (query) params.set("search", query);
        } else if (query && typeof query === "object") {
            Object.entries(query).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                    value.forEach((item) => {
                        if (item !== undefined && item !== "") params.append(key, String(item));
                    });
                    return;
                }

                if (value !== undefined && value !== "") params.set(key, String(value));
            });
        }

        const data = await apiGet(`/core/clients/?${params.toString()}`);
        const rows = normalizeClientRows(data);
        serverItemCount.set(typeof data?.count === "number" && data.count >= 0 ? data.count : rows.length);
        return rows;
    } catch (error) {
        console.error(error);
        return [];
    } finally {
        isLoading.set(false);
    }
}

export function setupTable(
    initialData: Client[],
    columnWidths: Record<string, number> = {},
    pageSize = pageSizeCache,
    initialSortKeys: TableSortKey[] = [],
) {
    const orderingMap = tableSettingsCache.reduce<Record<string, string>>((map, setting) => {
        if (typeof setting.dataOrigin === "string") map[setting.dataOrigin] = setting.dataOrigin;
        return map;
    }, { ...baseOrderingMap });

    return setupDataTable<Client>({
        initialData,
        tableSettings: tableSettingsCache,
        pageSize,
        serverItemCount,
        columnWidths,
        orderingMap,
        form,
        initialSortKeys,
    });
}
