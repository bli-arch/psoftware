import { slugify } from "$lib/utils";
import type { InputType } from "../istyler";
import {
    normalizeRangeBounds,
    normalizeRangeStep,
    readIntervalRangeValue,
    readSingleRangeValue,
} from "../istyler/rangeValue";
import {
    clampDateValue,
    normalizeDateBounds,
    normalizeDateMode,
} from "../istyler/dateValue";
import {
    dateDisplayOptions,
    defaultDateDisplayFormat,
    fieldSchema,
    type FieldSchemaControl,
    type FieldSchemaEntry,
    type FieldSchemaGroup,
} from "./fieldSchema";
import type { DroppedItem } from "./stores";

export type SerializedBuilderItem = {
    id: string;
    type: InputType;
    gx: number;
    gy: number;
    w: number;
    h: number;
    config: Record<string, any>;
    items?: SerializedBuilderItem[];
};

function isGroup(entry: FieldSchemaEntry): entry is FieldSchemaGroup {
    return "items" in entry;
}

function schemaControls(entries: FieldSchemaEntry[] = []): FieldSchemaControl[] {
    return entries.flatMap((entry) => isGroup(entry) ? entry.items : [entry]);
}

export function schemaWithDefaults(type: InputType, props: Record<string, any> = {}) {
    const next = { ...props };

    for (const control of schemaControls(fieldSchema[type] ?? [])) {
        if (!("defaultValue" in control) || next[control.key] !== undefined) continue;
        next[control.key] = typeof control.defaultValue === "function"
            ? control.defaultValue(next)
            : control.defaultValue;
    }

    if (type === "range") {
        const [min, max] = normalizeRangeBounds(next.min, next.max);
        next.min = min;
        next.max = max;
        next.step = normalizeRangeStep(next.step);

        if (next.value !== null && next.value !== undefined && next.value !== "") {
            next.value = next.range
                ? readIntervalRangeValue(next.value, min, max)
                : readSingleRangeValue(next.value, min, max);
        }
    }

    if (type === "date") {
        const mode = normalizeDateMode(next.mode);
        const showSeconds = next.showSeconds === true;
        const [min, max] = normalizeDateBounds(next.min, next.max, mode, showSeconds);

        next.mode = mode;
        next.showSeconds = showSeconds;
        next.min = min;
        next.max = max;
        next.value = clampDateValue(next.value, min, max, mode, showSeconds);
        if (!dateDisplayOptions(mode).includes(next.displayValue)) {
            next.displayValue = mode === "time" || mode === "time-ms" ? "text" : "date";
        }
        if (mode === "time" || mode === "time-ms") {
            delete next.receiptFormat;
        } else {
            next.receiptFormat ??= defaultDateDisplayFormat(mode);
        }
    }

    return next;
}

export function settingsSchemaFor(type: InputType, nested = false): FieldSchemaEntry[] {
    const schema = fieldSchema[type] ?? [];
    if (!nested) return schema;

    const nestedOnlyKeys = new Set(["clientIdentityRole", "displayValue", "receiptDisplay", "receiptLabel", "receiptFormat", "receiptOrder"]);

    return schema
        .map((entry) => {
            if (!isGroup(entry)) return nestedOnlyKeys.has(entry.key) ? null : entry;

            const items = entry.items.filter((control) => !nestedOnlyKeys.has(control.key));
            if (!items.length || entry.title === "Affichage" || entry.title === "Identité client" || entry.title === "Reçu") return null;
            return { ...entry, items };
        })
        .filter((entry): entry is FieldSchemaEntry => Boolean(entry));
}

function stableFieldName(props: Record<string, any> = {}) {
    const existingName = props.name as string | undefined;
    return existingName && existingName.length > 0
        ? existingName
        : `${crypto.randomUUID().split("-").pop()}-${slugify(String(props.label ?? "champ"))}`;
}

function stripNestedDisplay(config: Record<string, any>) {
    const { clientIdentityRole, displayValue, operationDisplay, format, receiptDisplay, receiptLabel, receiptFormat, receiptOrder, ...rest } = config;
    return rest;
}

export function serializeBuilderItem(
    { id, type, gx, gy, w, h, props = {}, items = [] }: DroppedItem,
    nested = false
): SerializedBuilderItem {
    const inputType = type as InputType;
    const nestedItems: SerializedBuilderItem[] = (items ?? []).map((item: DroppedItem) => serializeBuilderItem(item, true));
    const baseConfig: Record<string, any> = {
        ...schemaWithDefaults(inputType, props),
        type: inputType,
        name: stableFieldName(props),
        ...(type === "dynamicgroup"
            ? { fields: nestedItems.map((item: SerializedBuilderItem) => item.config) }
            : {}),
    };
    const config: Record<string, any> = nested ? stripNestedDisplay(baseConfig) : baseConfig;

    return {
        id,
        type,
        gx,
        gy,
        w,
        h,
        config,
        ...(nestedItems.length ? { items: nestedItems } : {}),
    };
}

export function groupFieldsFromItems(items: DroppedItem[] = []) {
    return items.map((item) => serializeBuilderItem(item, true).config);
}

export function createGroupEntry(fields: Record<string, any>[] = [], checkable = false) {
    const entry: Record<string, any> = {};

    for (const field of fields) {
        if (!field?.name) continue;
        if (field.value !== undefined) entry[field.name] = field.value;
        else if (field.type === "checkbox") entry[field.name] = false;
        else entry[field.name] = "";
    }

    if (checkable) entry.done = false;
    return entry;
}

export function groupPreviewValue(props: Record<string, any> = {}, fields: Record<string, any>[] = []) {
    if (Array.isArray(props.value)) {
        return props.value.map((entry) => ({
            ...createGroupEntry(fields, Boolean(props.checkable)),
            ...(entry && typeof entry === "object" ? entry : {}),
        }));
    }

    const count = Math.max(0, Number(props.minItems ?? 1));
    return Array.from({ length: count }, () => createGroupEntry(fields, Boolean(props.checkable)));
}

export function groupSummary(value: unknown, checkable = false) {
    if (!Array.isArray(value)) return null;

    const total = value.length;
    const done = checkable ? value.filter((item: any) => item?.done === true).length : 0;

    return {
        total,
        done,
        text: checkable ? `${done}/${total}` : `${total}`,
    };
}
