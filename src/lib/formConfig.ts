export type UnknownRecord = Record<string, unknown>;

export type NormalizedFormConfig = UnknownRecord & {
    form: UnknownRecord & { pages: UnknownRecord[] };
    settings: UnknownRecord & {
        pageSize: number;
        tableSettings: UnknownRecord[];
    };
};

export const isRecord = (value: unknown): value is UnknownRecord =>
    Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const recordOrEmpty = (value: unknown): UnknownRecord =>
    isRecord(value) ? value : {};

export const recordList = (value: unknown): UnknownRecord[] => {
    const list = Array.isArray(value)
        ? value
        : isRecord(value) && Array.isArray(value.results)
            ? value.results
            : [];

    return list.filter(isRecord);
};

export const positiveInteger = (value: unknown): number | null =>
    typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;

export function normalizePageSize(value: unknown, fallback = 15): number {
    const safeFallback = positiveInteger(fallback);
    const pageSize = positiveInteger(value);

    return pageSize !== null && pageSize <= 100
        ? pageSize
        : safeFallback !== null && safeFallback <= 100
            ? safeFallback
            : 15;
}

export function normalizeTableSettings(value: unknown): UnknownRecord[] {
    return recordList(value)
        .flatMap((setting, index) => {
            const dataOrigin = typeof setting.dataOrigin === "string" ? setting.dataOrigin.trim() : "";
            if (!dataOrigin) return [];

            const title = typeof setting.title === "string" && setting.title.trim()
                ? setting.title.trim()
                : dataOrigin;

            return [{
                setting,
                title,
                dataOrigin,
                configuredOrder: positiveInteger(setting.id),
                sourceIndex: index,
            }];
        })
        .sort((left, right) => {
            if (left.configuredOrder !== null && right.configuredOrder !== null) {
                return left.configuredOrder - right.configuredOrder || left.sourceIndex - right.sourceIndex;
            }
            if (left.configuredOrder !== null) return -1;
            if (right.configuredOrder !== null) return 1;
            return left.sourceIndex - right.sourceIndex;
        })
        .map(({ setting, title, dataOrigin }, index) => {
            const normalized: UnknownRecord = {
                ...setting,
                id: index + 1,
                title,
                dataOrigin,
            };

            if (typeof normalized.uuid !== "string" || !normalized.uuid.trim()) delete normalized.uuid;
            if (typeof normalized.display !== "string" || !normalized.display.trim()) delete normalized.display;
            if (typeof normalized.format !== "string") delete normalized.format;
            if (!isRecord(normalized.setting)) delete normalized.setting;

            return normalized;
        });
}

export function normalizeFormConfig(value: unknown): NormalizedFormConfig | null {
    if (!isRecord(value)) return null;

    const form = recordOrEmpty(value.form);
    const settings = isRecord(value.settings) ? value.settings : recordOrEmpty(form.settings);
    const pages = recordList(Array.isArray(form.pages) ? form.pages : value.pages);

    return {
        ...value,
        form: { ...form, pages },
        settings: {
            ...settings,
            pageSize: normalizePageSize(settings.pageSize),
            tableSettings: normalizeTableSettings(settings.tableSettings),
        },
    };
}

export function normalizeFormList(value: unknown): NormalizedFormConfig[] {
    return recordList(value)
        .map(normalizeFormConfig)
        .filter((form): form is NormalizedFormConfig => form !== null && positiveInteger(form.id) !== null);
}
