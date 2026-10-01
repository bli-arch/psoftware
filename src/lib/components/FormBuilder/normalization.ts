import type { DroppedItem, Page } from "./stores";
import { schemaWithDefaults } from "./builderFieldUtils";
import { recordList, recordOrEmpty } from "$lib/formConfig";
import { DEFAULT_FIELD_SIZES } from "./layout";

export type { Page, DroppedItem } from "./stores";

type NormalizedField = {
    gx: number;
    gy: number;
    w: number;
    h: number;
    config: Record<string, any>;
    formFields?: NormalizedField[];
};

const supportedFieldTypes = new Set([
    "checkbox",
    "date",
    "dynamicgroup",
    "iconpicker",
    "number",
    "password",
    "radio",
    "range",
    "select",
    "text",
    "textarea",
]);

function fieldConfig(field: any): Record<string, any> {
    if (field && typeof field === "object" && !Array.isArray(field)) {
        if (field.config && typeof field.config === "object" && !Array.isArray(field.config)) return field.config;
        if (field.props && typeof field.props === "object" && !Array.isArray(field.props)) return field.props;
    }

    return recordOrEmpty(field);
}

function nestedFields(field: any): any[] {
    return recordList(Array.isArray(field?.formFields) ? field.formFields : field?.items);
}

function finiteNumber(value: unknown, fallback: number, minimum = 0) {
    return typeof value === "number" && Number.isFinite(value)
        ? Math.max(minimum, value)
        : fallback;
}

function normalizeOptions(value: unknown): Record<string, any>[] {
    return recordList(value).flatMap((option) => {
        if (Array.isArray(option.options)) {
            const options = normalizeOptions(option.options);
            return options.length
                ? [{ ...option, label: typeof option.label === "string" ? option.label : "", options }]
                : [];
        }

        if (typeof option.value !== "string" && typeof option.value !== "number") return [];
        return [{
            ...option,
            label: typeof option.label === "string" ? option.label : String(option.value),
        }];
    });
}

function normalizeField(field: any): NormalizedField | null {
    const configSource = fieldConfig(field);
    const rawType = field?.type ?? configSource.type;
    const type = typeof rawType === "string" ? rawType.trim() : "";
    const name = typeof configSource.name === "string" ? configSource.name.trim() : "";
    if (!supportedFieldTypes.has(type) || !name) return null;

    const children = nestedFields(field)
        .map(normalizeField)
        .filter((child): child is NormalizedField => child !== null);
    const config: Record<string, any> = {
        ...schemaWithDefaults(type as Parameters<typeof schemaWithDefaults>[0], configSource),
        type,
        name,
        label: typeof configSource.label === "string" ? configSource.label : name,
    };

    if (type === "select" || type === "checkbox" || type === "radio") {
        config.options = normalizeOptions(config.options);
    }

    if (type === "dynamicgroup") {
        const nestedConfigs = children.length
            ? children.map((child: NormalizedField) => child.config)
            : recordList(config.fields)
                .map((nested) => normalizeField({ config: nested }))
                .filter((child): child is NormalizedField => child !== null)
                .map((child) => child.config);
        config.fields = nestedConfigs;
    }

    return {
        gx: finiteNumber(field.gx, 0),
        gy: finiteNumber(field.gy, 0),
        w: finiteNumber(field.w, 1, 1),
        h: finiteNumber(field.h, 1, 1),
        config,
        ...(children.length ? { formFields: children } : {}),
    };
}

function legacyGroupFieldToItem(field: any, index: number): DroppedItem {
    const config = fieldConfig(field);
    const rawType = config.type ?? field?.type;
    const type = (typeof rawType === "string" && supportedFieldTypes.has(rawType) ? rawType : "text") as DroppedItem["type"];
    const [w, h] = DEFAULT_FIELD_SIZES[type];

    return {
        id: crypto.randomUUID(),
        type,
        gx: (index % 2) * 16,
        gy: Math.floor(index / 2) * 6,
        w,
        h,
        props: { ...config, type },
    };
}

function denormalizeField(field: any): DroppedItem {
    const config = fieldConfig(field);
    const rawType = field?.type ?? config.type;
    const type = (typeof rawType === "string" && supportedFieldTypes.has(rawType) ? rawType : "text") as DroppedItem["type"];
    const children = nestedFields(field).length
        ? nestedFields(field).map(denormalizeField)
        : type === "dynamicgroup" && Array.isArray(config.fields)
            ? recordList(config.fields).map(legacyGroupFieldToItem)
            : [];

    return {
        id: typeof field.id === "string" && field.id ? field.id : crypto.randomUUID(),
        type,
        gx: finiteNumber(field.gx, 0),
        gy: finiteNumber(field.gy, 0),
        w: finiteNumber(field.w, 1, 1),
        h: finiteNumber(field.h, 1, 1),
        props: { ...config, type },
        ...(type === "dynamicgroup" ? { items: children } : {}),
    };
}

export function normalizeBuilderPages(pages: any[] = []) {
    return recordList(pages).map((page, index) => ({
        title: typeof page.title === "string" ? page.title : `Page ${index + 1}`,
        description: typeof page.description === "string" ? page.description : "",
        icon: typeof page.icon === "string" ? page.icon : undefined,
        iconColor: typeof page.iconColor === "string" ? page.iconColor : undefined,
        type: page.type === "client" ? "client" : "data",
        formFields: recordList(Array.isArray(page.items) ? page.items : page.formFields)
            .map(normalizeField)
            .filter((field): field is NormalizedField => field !== null),
    }));
}

export function denormalizeFormPages(pages: any[] = []): Page[] {
    return recordList(pages).map((page) => ({
        title: typeof page.title === "string" ? page.title : "",
        description: typeof page.description === "string" ? page.description : "",
        icon: typeof page.icon === "string" ? page.icon : undefined,
        iconColor: typeof page.iconColor === "string" ? page.iconColor : undefined,
        type: page.type === "client" ? "client" : "data",
        items: recordList(Array.isArray(page.formFields) ? page.formFields : page.items)
            .filter((field) => {
                const config = fieldConfig(field);
                const type = field.type ?? config.type;
                return typeof type === "string" && supportedFieldTypes.has(type);
            })
            .map(denormalizeField),
    }));
}
