import { createTable } from "svelte-headless-table";
import { addPagination, addResizedColumns, addSortBy, addTableFilter } from "svelte-headless-table/plugins";
import type { Writable } from "svelte/store";
import { writable } from "svelte/store";
import { renderTableCell, type DynamicGroupSummary, type TableCellDisplay } from "./tableDisplays";
import { isRecord, normalizePageSize, normalizeTableSettings, recordList, recordOrEmpty } from "$lib/formConfig";

export type DataTableRow = Record<string, any>;

export type DataTableSetting = {
    id: string | number;
    title: string;
    dataOrigin?: string;
    display?: TableCellDisplay | string;
    format?: string;
    [key: string]: any;
};

export type SetupDataTableOptions<Row extends DataTableRow> = {
    initialData: Row[];
    tableSettings: DataTableSetting[];
    pageSize: number;
    serverItemCount: Writable<number>;
    columnWidths?: Record<string, number>;
    orderingMap?: Record<string, string>;
    form?: any;
    states?: Array<Record<string, any>>;
    initialSortKeys?: Array<{ id: string; order: "asc" | "desc" }>;
};

function getFieldConfig(form: any, dataOrigin?: string): Record<string, any> | null {
    if (!dataOrigin) return null;

    const [pageType, ...fieldParts] = dataOrigin.split(".");
    if (!fieldParts.length) return null;

    const targetName = fieldParts.join(".");
    const pages = recordList(form?.form?.pages ?? form?.pages);

    for (const page of pages) {
        const currentPageType = page?.type ?? "data";
        if (currentPageType !== pageType) continue;

        const fields = recordList(Array.isArray(page.formFields) ? page.formFields : page.items);
        for (const field of fields) {
            const config = isRecord(field.config)
                ? field.config
                : isRecord(field.props)
                    ? field.props
                    : recordOrEmpty(field);
            const fieldName = config?.name ?? field?.name;
            const fieldType = config?.type ?? field?.type;

            if (fieldName === targetName) return { ...config, type: fieldType } as Record<string, any>;
        }
    }

    return null;
}

function getValueByPath(row: DataTableRow, dataOrigin?: string) {
    if (typeof dataOrigin !== "string") return "";

    let value: any = row;
    for (const key of dataOrigin.split(".")) {
        if (value && value[key] !== undefined) {
            value = value[key];
        } else if (value?.data && typeof value.data === "object" && value.data[key] !== undefined) {
            value = value.data[key];
        } else {
            return "";
        }
    }

    return value;
}

function summarizeDynamicGroup(value: unknown, checkable: boolean): DynamicGroupSummary | null {
    if (!Array.isArray(value)) return null;

    const total = value.length;
    const done = checkable ? value.filter((item: any) => item?.done === true).length : 0;

    return {
        total,
        done,
        text: checkable ? `${done}/${total}` : `${total}`
    };
}

export function setupDataTable<Row extends DataTableRow>({
    initialData,
    tableSettings,
    pageSize,
    serverItemCount,
    columnWidths = {},
    orderingMap = {},
    form = null,
    states = [],
    initialSortKeys = []
}: SetupDataTableOptions<Row>) {
    const data = writable(recordList(initialData) as Row[]);
    const safeTableSettings = normalizeTableSettings(tableSettings) as DataTableSetting[];
    const safePageSize = normalizePageSize(pageSize);
    const safeStates = recordList(states);

    const table = createTable<Row>(data, {
        resize: addResizedColumns(),
        sort: addSortBy({
            initialSortKeys,
            serverSide: true
        }),
        tableFilter: addTableFilter({
            serverSide: true
        }),
        page: addPagination({
            serverSide: true,
            serverItemCount,
            initialPageSize: safePageSize
        })
    });

    const columns = table.createColumns(
        safeTableSettings.map((setting) => {
            const fieldConfig = getFieldConfig(form, setting.dataOrigin);
            const isDynamicGroupColumn = fieldConfig?.type === "dynamicgroup";
            const isCheckableDynamicGroup = Boolean(fieldConfig?.checkable);
            const displaySetting = {
                ...(fieldConfig ?? {}),
                ...setting,
                display: setting.dataOrigin === "state"
                    ? "state"
                    : setting.display ?? fieldConfig?.displayValue ?? fieldConfig?.operationDisplay
            };
            const sortableOrigin = typeof setting.dataOrigin === "string" ? setting.dataOrigin : "";
            const sortableRoot = sortableOrigin.split(".")[0];
            const valueForDisplay = (row: Row) => {
                if (displaySetting.display === "user" && sortableOrigin.includes(".")) {
                    const parent = getValueByPath(row, sortableOrigin.split(".").slice(0, -1).join("."));
                    if (parent && typeof parent === "object") return parent;
                }
                return getValueByPath(row, setting.dataOrigin);
            };

            return table.column({
                id: String(setting.id),
                header: setting.title,
                accessor: valueForDisplay,
                cell: ({ value }: { value: unknown }) => {
                    const dynamicGroup = isDynamicGroupColumn
                        ? summarizeDynamicGroup(value, isCheckableDynamicGroup)
                        : null;

                    return renderTableCell({ value, setting: displaySetting, states: safeStates, dynamicGroup });
                },
                plugins: {
                    resize: {
                        initialWidth: columnWidths[setting.id] ?? 150
                    },
                    sort: {
                        disable: !(sortableOrigin in orderingMap) && !(sortableRoot in orderingMap)
                    }
                }
            });
        })
    );

    return { table, columns, data, serverItemCount };
}
