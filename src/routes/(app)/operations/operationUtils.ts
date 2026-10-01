import type { DynamicGroupConfig } from "$lib/components/istyler/DynamicGroup.svelte";
import {
    resolveClientIdentity,
    type ClientIdentityFields,
} from "$lib/clientIdentity";
import { colorToneStyle, cssColor } from "$lib/color";
import { isRecord, recordList, recordOrEmpty } from "$lib/formConfig";

export { buildClientIdentityFields } from "$lib/clientIdentity";
export type { ClientIdentityFields } from "$lib/clientIdentity";

export type FieldLabelMap = {
    client: Record<string, string>;
    data: Record<string, string>;
};

export type SummaryRow = {
    id: string;
    label: string;
    value: any;
    display?: string;
    setting?: Record<string, any>;
};
export type SummarySection = { id: string; title: string; rows: SummaryRow[]; icon: string; iconColor?: string };
export type SummaryTone = "orange" | "blue" | "amber" | "green" | "purple";
export type SummaryCard = {
    id: string;
    title: string;
    preview: string;
    badge: string;
    stepIndex: number;
    rows: SummaryRow[];
    tone: SummaryTone;
    icon: string;
    iconColor?: string;
};
export type WorkflowStep = { id: string; label: string };
export type FormDataType = keyof FieldLabelMap;
export type FieldChange = { name: string; label: string; from: any; to: any };

export const PANEL_META: Record<string, { title: string; subtitle: string }> = {
    activity: {
        title: "Activité",
        subtitle: "Historique des actions",
    },
    notes: {
        title: "Notes",
        subtitle: "Messages et coordination d'équipe",
    },
    about: {
        title: "À propos",
        subtitle: "Synthèse et statistiques",
    },
};

export const asList = (value: any) => recordList(value);

export const cloneSnapshot = (value: any) => JSON.parse(JSON.stringify(value));

export const cloneValue = <T,>(value: T): T => {
    return JSON.parse(JSON.stringify(value));
};

export const sortKeysDeep = (value: any): any => {
    if (Array.isArray(value)) return value.map(sortKeysDeep);
    if (value && typeof value === "object") {
        return Object.keys(value)
            .sort()
            .reduce<Record<string, any>>((acc, key) => {
                acc[key] = sortKeysDeep(value[key]);
                return acc;
            }, {});
    }
    return value;
};

export const deepEqual = (a: any, b: any) =>
    JSON.stringify(sortKeysDeep(a)) === JSON.stringify(sortKeysDeep(b));

export const getFieldConfig = (field: any): Record<string, any> =>
    isRecord(field?.config)
        ? field.config
        : isRecord(field?.props)
            ? field.props
            : recordOrEmpty(field);

export const getSectionFields = (section: any) =>
    recordList(Array.isArray(section?.formFields) ? section.formFields : section?.items);

export const getSectionId = (section: any, index: number) =>
    `${section?.type === "client" ? "client" : "operation"}-${section?.id ?? section?.title ?? index}`;

export const normalizeRecord = (value: any): Record<string, any> =>
    value && typeof value === "object" && !Array.isArray(value) ? value : {};

export const buildDynamicGroupSeed = (fields: DynamicGroupConfig[] = []) => {
    const entry: Record<string, any> = {};

    (recordList(fields) as DynamicGroupConfig[]).forEach((field) => {
        if (field.value !== undefined) entry[field.name] = field.value;
        else if (field.type === "checkbox") entry[field.name] = field.options?.length ? [] : false;
        else if (field.type === "range" && field.range) entry[field.name] = [field.min ?? 0, field.max ?? 100];
        else entry[field.name] = "";
    });

    return [entry];
};

export const getDefaultFieldValue = (config: Record<string, any>) => {
    if (config.value !== undefined) return cloneValue(config.value);
    if (config.type === "checkbox") return config.options?.length ? [] : false;
    if (config.type === "range" && config.range) return [config.min ?? 0, config.max ?? 100];
    return "";
};

export const seedFormData = (pages: any[] = [], data: Record<string, any>) => {
    recordList(pages).forEach((page: any) => {
        getSectionFields(page).forEach((field: any) => {
            const config = getFieldConfig(field);
            if (!config?.name) return;

            if (config.type === "dynamicgroup") {
                if (!Array.isArray(data[config.name])) {
                    data[config.name] = buildDynamicGroupSeed(config.fields);
                }
            } else if (data[config.name] === undefined) {
                data[config.name] = getDefaultFieldValue(config);
            }
        });
    });

    return data;
};

export const buildFieldLabelMap = (pages: any[] = []) => {
    const labels: FieldLabelMap = {
        client: {},
        data: {},
    };

    recordList(pages).forEach((page: any) => {
        const pageType: FormDataType = page?.type === "client" ? "client" : "data";

        getSectionFields(page).forEach((field: any) => {
            const config = getFieldConfig(field);
            if (config?.name) {
                labels[pageType][config.name] = config.label ?? config.name;
            }
        });
    });

    return labels;
};

export const humanizeLabel = (value: string) =>
    value
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^\w/, (char) => char.toUpperCase());

export const hasSummaryValue = (value: any): boolean => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.values(value).some(hasSummaryValue);
    return true;
};

export const isFilledValue = (value: any): boolean => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (typeof value === "number") return !Number.isNaN(value);
    if (typeof value === "boolean") return value;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.values(value).some(isFilledValue);
    return true;
};

export const formatSummaryValue = (value: any): string => {
    if (!hasSummaryValue(value)) return "Non renseigné";
    if (typeof value === "string") return value.trim();
    if (typeof value === "boolean") return value ? "Oui" : "Non";
    if (typeof value === "number" || typeof value === "bigint") return String(value);

    if (Array.isArray(value)) {
        if (value.every((entry) => entry === null || ["string", "number", "boolean"].includes(typeof entry))) {
            return value.map((entry) => formatSummaryValue(entry)).join(", ");
        }

        return value
            .map((entry, index) => {
                if (!entry || typeof entry !== "object") return `${index + 1}. ${formatSummaryValue(entry)}`;
                const line = Object.entries(entry)
                    .filter(([, nested]) => hasSummaryValue(nested))
                    .slice(0, 4)
                    .map(([key, nested]) => `${humanizeLabel(key)}: ${formatSummaryValue(nested)}`)
                    .join(" | ");

                return `${index + 1}. ${line || "Entrée"}`;
            })
            .join("\n");
    }

    if (typeof value === "object") {
        return Object.entries(value)
            .filter(([, nested]) => hasSummaryValue(nested))
            .slice(0, 5)
            .map(([key, nested]) => `${humanizeLabel(key)}: ${formatSummaryValue(nested)}`)
            .join(" | ");
    }

    return String(value);
};

export const formatFieldValue = (value: any): string => {
    if (!hasSummaryValue(value)) return "-";
    if (typeof value === "boolean") return value ? "Oui" : "Non";
    if (typeof value === "number" || typeof value === "bigint") return String(value);
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
        if (value.every((entry) => entry === null || ["string", "number", "boolean"].includes(typeof entry))) {
            return value.map(formatFieldValue).join(", ");
        }
        return `${value.length} élément${value.length > 1 ? "s" : ""}`;
    }
    if (typeof value === "object") {
        return Object.entries(value)
            .filter(([, nested]) => hasSummaryValue(nested))
            .slice(0, 4)
            .map(([key, nested]) => `${humanizeLabel(key)}: ${formatFieldValue(nested)}`)
            .join(" | ");
    }
    return String(value);
};

export const isPasswordField = (config?: Record<string, any>): boolean =>
    [config?.type, config?.displayValue, config?.operationDisplay]
        .some((value) => String(value ?? "").toLowerCase() === "password");

export const formatDisplayedFieldValue = (value: any, config?: Record<string, any>): string =>
    isPasswordField(config) ? (hasSummaryValue(value) ? "****" : "-") : formatFieldValue(value);

export const countFilledRows = (rows: SummaryRow[]) =>
    rows.reduce((count, row) => count + (hasSummaryValue(row.value) ? 1 : 0), 0);

export const getSectionPreview = (rows: SummaryRow[], fallback: string) => {
    const preview = rows
        .filter((row) => hasSummaryValue(row.value))
        .slice(0, 2)
        .map((row) => formatSummaryValue(row.value).replace(/\s+/g, " "))
        .join(" · ");

    return preview || fallback;
};

export const getPagePreview = (pageData: any, getValue: (pageType: string | undefined, name: string) => any): string => {
    const previews = getSectionFields(pageData)
        .slice(0, 3)
        .map((field: any) => {
            const config = getFieldConfig(field);
            if (!config?.name) return null;
            const formatted = formatDisplayedFieldValue(getValue(pageData?.type, config.name), config);
            return formatted !== "-" ? formatted : null;
        })
        .filter(Boolean);

    return previews.join(" · ") || "Aucune donnée";
};

export const getClientSource = (client: any) =>
    client?.data && typeof client.data === "object" ? client.data : client;

export const getClientId = (client: any) => client?.id ?? client?.uid ?? null;

const getConfiguredClientKeys = (labels: Record<string, string> = {}) => Object.keys(labels);

const getFirstFilledClientKey = (
    client: any,
    labels: Record<string, string> = {},
    skip: string[] = [],
) => {
    const source = getClientSource(client) ?? {};
    const ignoredKeys = ["id", "uid", "pk", "form", "creator", "created_by", "user", "data"];
    const keys = [...getConfiguredClientKeys(labels), ...Object.keys(source)];

    return [...new Set(keys)].find((key) => !ignoredKeys.includes(key) && !skip.includes(key) && hasSummaryValue(source?.[key])) ?? null;
};

export const getClientName = (
    client: any,
    labels: Record<string, string> = {},
    identityFields: ClientIdentityFields = {},
) => {
    if (Object.values(identityFields).some(Boolean)) {
        return resolveClientIdentity(client, identityFields).primary;
    }

    const source = getClientSource(client) ?? {};
    const nameKey = getFirstFilledClientKey(client, labels);

    return nameKey ? formatSummaryValue(source[nameKey]) : `Client #${getClientId(client) ?? ""}`.trim();
};

export const getClientSecondaryName = (
    client: any,
    identityFields: ClientIdentityFields = {},
) => Object.values(identityFields).some(Boolean)
    ? resolveClientIdentity(client, identityFields).secondary
    : "";

export const getClientMeta = (client: any, labels: Record<string, string> = {}) => {
    const source = getClientSource(client) ?? {};
    const nameKey = getFirstFilledClientKey(client, labels);
    const metaKey = getFirstFilledClientKey(client, labels, nameKey ? [nameKey] : []);

    if (!metaKey) return "Aucune information supplémentaire";
    return `${labels[metaKey] ?? humanizeLabel(metaKey)}: ${formatSummaryValue(source[metaKey])}`;
};

export const getClientInitials = (
    client: any,
    labels: Record<string, string> = {},
    identityFields: ClientIdentityFields = {},
) => {
    const label = getClientName(client, labels, identityFields) || String(getClientId(client) ?? "CL");

    return label
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part: string) => part[0]?.toUpperCase() ?? "")
        .join("")
        .slice(0, 2) || "CL";
};

export const getAvatarClass = (index: number) =>
    ["bg-(--user-color)/10 text-(--user-color)", "bg-(--blue)/10 text-(--blue)", "bg-(--green)/10 text-(--green)"][
        index % 3
    ];

export const getSummaryIcon = (page: any, fallback = "ClipboardList") => {
    if (typeof page?.icon === "string" && page.icon.trim()) return page.icon.trim();

    const firstField = getSectionFields(page).find((field: any) => {
        const config = getFieldConfig(field);
        return config?.name || config?.type;
    });
    const config = getFieldConfig(firstField);

    const fieldIcons: Record<string, string> = {
        checkbox: "CheckSquare",
        date: "Calendar",
        dynamicgroup: "Rows3",
        number: "Hash",
        radio: "CircleDot",
        range: "SlidersHorizontal",
        select: "ListFilter",
        textarea: "AlignLeft",
        text: "TextCursorInput",
    };

    return fieldIcons[config?.type] ?? fallback;
};

const pageIconToneClasses: Record<string, string> = {
    "--page-icon-user": "bg-(--page-icon-user-transparent) text-(--page-icon-user)",
    "--page-icon-blue": "bg-(--page-icon-blue-transparent) text-(--page-icon-blue)",
    "--page-icon-green": "bg-(--page-icon-green-transparent) text-(--page-icon-green)",
    "--page-icon-orange": "bg-(--page-icon-orange-transparent) text-(--page-icon-orange)",
    "--page-icon-red": "bg-(--page-icon-red-transparent) text-(--page-icon-red)",
    "--page-icon-purple": "bg-(--page-icon-purple-transparent) text-(--page-icon-purple)",
    "--page-icon-slate": "bg-(--page-icon-slate-transparent) text-(--page-icon-slate)",
};

export const getPageIconToneClass = (page: any, fallback: string) => {
    const iconColor = typeof page?.iconColor === "string" ? page.iconColor : "";
    return pageIconToneClasses[iconColor] ?? fallback;
};

export const getPageIconToneStyle = (page: any, gradient = false) => {
    const iconColor = typeof page?.iconColor === "string" ? page.iconColor : "";
    if (gradient) {
        const color = cssColor(iconColor, "var(--page-icon-user)");
        return `background:linear-gradient(45deg, color-mix(in srgb, ${color} 12%, white), white 24%);`;
    }
    return pageIconToneClasses[iconColor] ? undefined : colorToneStyle(iconColor, "");
};

export const getEditableData = (source: any, pageType: FormDataType, labels: FieldLabelMap) => {
    const base = pageType === "client" ? (source?.data ?? source) : source;
    if (!base || typeof base !== "object") return {};

    const allowed = Object.keys(labels[pageType] ?? {});
    const keys = allowed.length ? allowed : Object.keys(base);

    return keys.reduce<Record<string, any>>((acc, key) => {
        if (base[key] !== undefined) acc[key] = base[key];
        return acc;
    }, {});
};

export const collectFieldChanges = (
    initialData: Record<string, any>,
    nextData: Record<string, any>,
    labels: Record<string, string> = {},
): FieldChange[] => {
    const keys = new Set([...Object.keys(initialData ?? {}), ...Object.keys(nextData ?? {})]);
    const changes: FieldChange[] = [];

    keys.forEach((key) => {
        const prev = initialData?.[key];
        const next = nextData?.[key];
        if (!deepEqual(prev, next)) {
            changes.push({
                name: key,
                label: labels[key] ?? humanizeLabel(key),
                from: prev,
                to: next,
            });
        }
    });

    return changes;
};

export const isFieldValueValid = (config: Record<string, any>, value: any): boolean => {
    if (!config || config.disabled || config.readonly || config.hidden) return true;

    if (config.type === "dynamicgroup") {
        const entries = Array.isArray(value) ? value : [];
        const minItems = Math.max(0, Number(config.minItems ?? 0));

        if (entries.length < minItems) return false;

        return entries.every((entry: Record<string, any>) =>
            recordList(config.fields).every((nestedField: Record<string, any>) =>
                !nestedField.required || isFilledValue(entry?.[nestedField.name])
            )
        );
    }

    if (config.required && !isFilledValue(value)) return false;

    if (config.type === "range" && config.range && value !== "" && value !== null && value !== undefined) {
        const rangeValues = Array.isArray(value)
            ? value
            : typeof value === "object"
                ? [value?.min, value?.max]
                : [];
        if (rangeValues.length !== 2) return false;

        const low = Number(rangeValues[0]);
        const high = Number(rangeValues[1]);
        if (Number.isNaN(low) || Number.isNaN(high)) return false;
        if (low > high) return false;
        if (config.min !== undefined && low < Number(config.min)) return false;
        if (config.max !== undefined && high > Number(config.max)) return false;
    } else if ((config.type === "number" || config.type === "range") && value !== "" && value !== null && value !== undefined) {
        const numericValue = Number(value);
        if (Number.isNaN(numericValue)) return false;
        if (config.min !== undefined && numericValue < Number(config.min)) return false;
        if (config.max !== undefined && numericValue > Number(config.max)) return false;
    }

    return true;
};

export const findInvalidFormStep = ({
    pages,
    startIndex,
    targetIndex,
    maxStep,
    data,
}: {
    pages: any[];
    startIndex: number;
    targetIndex: number;
    maxStep: number;
    data: Record<string, any>;
}): number | null => {
    const safePages = recordList(pages);
    const boundedTarget = Math.max(0, Math.min(targetIndex, maxStep));
    if (boundedTarget <= startIndex) return null;

    for (let index = startIndex; index < boundedTarget; index += 1) {
        if (index <= 0 || index > safePages.length) continue;

        const page = safePages[index - 1];
        const isValid = getSectionFields(page).every((field: any) => {
            const config = getFieldConfig(field);
            return !config?.name || isFieldValueValid(config, data?.[config.name]);
        });

        if (!isValid) return index;
    }

    return null;
};

export const validateSectionDraft = (section: any, draft: Record<string, any>) =>
    getSectionFields(section).every((field: any) => {
        const config = getFieldConfig(field);
        return !config?.name || isFieldValueValid(config, draft?.[config.name]);
    });

export const inferInputType = (value: any) => {
    if (typeof value === "boolean") return "checkbox";
    if (typeof value === "number") return "number";
    return "text";
};

export const buildClientDataSection = (
    source: Record<string, any>,
    sourceKeys: string[],
    sourcePages: any[],
) => {
    if (!sourceKeys.length) return null;

    const sourceKeySet = new Set(sourceKeys);
    const configuredFields = new Map<string, Record<string, any>>();
    const orderedFieldNames: string[] = [];

    const safeSourcePages = recordList(sourcePages);
    safeSourcePages.forEach((section) => {
        getSectionFields(section).forEach((field: any) => {
            const config = getFieldConfig(field);
            if (config?.name && sourceKeySet.has(config.name)) {
                configuredFields.set(config.name, config);
                if (!orderedFieldNames.includes(config.name)) {
                    orderedFieldNames.push(config.name);
                }
            }
        });
    });

    const sectionFieldNames = [
        ...orderedFieldNames,
        ...sourceKeys.filter((name) => !orderedFieldNames.includes(name)),
    ];

    return {
        id: "client-data",
        type: "client",
        title: "Client",
        icon: safeSourcePages[0]?.icon,
        iconColor: safeSourcePages[0]?.iconColor,
        formFields: sectionFieldNames.map((name) => {
            const config = configuredFields.get(name) ?? {};
            return {
                config: {
                    ...config,
                    name,
                    label: config.label ?? humanizeLabel(name),
                    type: config.type ?? inferInputType(source[name]),
                },
            };
        }),
    };
};

export const isClientDuplicateSection = (section: any, sourceKeys: string[], sourceKeySet: Set<string>) => {
    const sectionFieldNames = getSectionFields(section)
        .map((field: any) => getFieldConfig(field).name)
        .filter(Boolean)
        .sort();
    const sectionTitle = String(section?.title ?? "").trim().toLowerCase();

    return section?.type === "client"
        || (
            sourceKeys.length > 0
            && (
                sectionTitle === "information"
                || sectionTitle === "informations"
                || (
                    sectionFieldNames.length > 0
                    && sectionFieldNames.every((name: string) => sourceKeySet.has(name))
                )
            )
        );
};

export const buildAccordionSections = (
    clientSection: any,
    operationSections: any[],
    sourceKeys: string[],
) => {
    const sourceKeySet = new Set(sourceKeys);
    return [
        ...(clientSection ? [clientSection] : []),
        ...recordList(operationSections).filter((section) => !isClientDuplicateSection(section, sourceKeys, sourceKeySet)),
    ];
};

export const seedSectionDraft = (section: any, source: Record<string, any>) => {
    const draft: Record<string, any> = {};

    getSectionFields(section).forEach((field: any) => {
        const config = getFieldConfig(field);
        if (!config?.name) return;

        if (source[config.name] !== undefined) {
            draft[config.name] = cloneValue(source[config.name]);
        } else if (config.type === "dynamicgroup") {
            draft[config.name] = buildDynamicGroupSeed(config.fields ?? []);
        } else {
            draft[config.name] = getDefaultFieldValue(config);
        }
    });

    return draft;
};

export const collectSectionChanges = (
    section: any,
    previousSource: Record<string, any>,
    nextDraft: Record<string, any>,
): FieldChange[] => {
    const changes: FieldChange[] = [];

    getSectionFields(section).forEach((field: any) => {
        const config = getFieldConfig(field);
        if (!config?.name) return;

        const previous = previousSource?.[config.name];
        const next = nextDraft?.[config.name];

        if (!deepEqual(previous, next)) {
            changes.push({
                name: config.name,
                label: config.label ?? humanizeLabel(config.name),
                from: previous,
                to: next,
            });
        }
    });

    return changes;
};

export const getPageToneClass = (pageType: string | undefined, index: number) => {
    if (pageType === "client") return "bg-(--user-color)/10 text-(--user-color)";
    const tones = [
        "bg-(--blue)/10 text-(--blue)",
        "bg-(--green)/10 text-(--green)",
        "bg-(--orange)/10 text-(--orange)",
        "bg-(--red)/10 text-(--red)",
    ];
    return tones[index % tones.length];
};

export const groupKey = (pageType: string | undefined, fieldName: string, index: number) =>
    `${pageType ?? "data"}-${fieldName}-${index}`;

export const sortStates = (list: Array<Record<string, any>>) =>
    recordList(list).sort((a, b) => (Number(a?.step) || Number.MAX_SAFE_INTEGER) - (Number(b?.step) || Number.MAX_SAFE_INTEGER));

export const getStateAccent = (state: Record<string, any> | null | undefined, fallback = "transparent") =>
    cssColor(state?.settings?.color, fallback) ?? fallback;

export const getUserLabel = (user: Record<string, any> | null | undefined, fallback = "Inconnu") => {
    if (!user) return fallback;
    return user.username || [user.name, user.lastname].filter(Boolean).join(" ") || fallback;
};

export const getOperationClientCreator = (operation: Record<string, any> | null | undefined) => {
    const creator = operation?.client?.creator;
    if (creator && typeof creator === "object") {
        return creator.id ?? creator.pk ?? creator.user ?? creator;
    }
    return creator;
};
