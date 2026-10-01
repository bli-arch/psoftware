import { isRecord, recordList, recordOrEmpty } from "$lib/formConfig";

export type ActivityFieldChange = {
    name: string;
    label?: string;
    type?: string;
    from: unknown;
    to: unknown;
};

type ActivityPrivacyRule = {
    hidden: boolean;
    hiddenKeys: string[];
};

export type ActivityPrivacyMap = Record<string, ActivityPrivacyRule>;

const fieldConfig = (field: any): Record<string, any> =>
    isRecord(field?.config)
        ? field.config
        : isRecord(field?.props)
            ? field.props
            : recordOrEmpty(field);

const sectionFields = (section: any): any[] =>
    recordList(Array.isArray(section?.formFields) ? section.formFields : section?.items);

const isPasswordType = (value: unknown) =>
    String(value ?? "").toLowerCase() === "password";

const isPasswordName = (value: unknown) => {
    const normalized = String(value ?? "")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "");

    return normalized.includes("password") || normalized.includes("motdepasse");
};

const stable = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
    if (value && typeof value === "object") {
        return `{${Object.keys(value as Record<string, unknown>)
            .sort()
            .map((key) => `${key}:${stable((value as Record<string, unknown>)[key])}`)
            .join(",")}}`;
    }
    return JSON.stringify(value) ?? String(value);
};

const sanitizeValue = (value: unknown, hiddenKeys: Set<string>): unknown => {
    if (Array.isArray(value)) return value.map((entry) => sanitizeValue(entry, hiddenKeys));
    if (!value || typeof value !== "object") return value;

    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
            .filter(([key]) => !hiddenKeys.has(key) && !isPasswordName(key))
            .map(([key, nested]) => [key, sanitizeValue(nested, hiddenKeys)]),
    );
};

export const buildActivityPrivacyMap = (pages: any[] = []): ActivityPrivacyMap => {
    const privacy: ActivityPrivacyMap = {};

    recordList(pages).forEach((page) => {
        sectionFields(page).forEach((field) => {
            const config = fieldConfig(field);
            if (!config.name) return;

            const nestedFields = config.fields ?? sectionFields(field);
            const hiddenKeys = Array.isArray(nestedFields)
                ? nestedFields
                    .map(fieldConfig)
                    .filter((nested) => nested.name && isPasswordType(nested.type))
                    .map((nested) => String(nested.name))
                : [];
            const hidden = isPasswordType(config.type);

            if (!hidden && !hiddenKeys.length) return;

            const previous = privacy[config.name];
            privacy[config.name] = {
                hidden: Boolean(previous?.hidden || hidden),
                hiddenKeys: [...new Set([...(previous?.hiddenKeys ?? []), ...hiddenKeys])],
            };
        });
    });

    return privacy;
};

export const sanitizeActivityFieldChange = (
    field: ActivityFieldChange,
    privacy: ActivityPrivacyMap = {},
): ActivityFieldChange | null => {
    const rule = privacy[field.name];
    if (rule?.hidden || isPasswordType(field.type) || isPasswordName(field.name) || isPasswordName(field.label)) {
        return null;
    }

    const hiddenKeys = new Set(rule?.hiddenKeys ?? []);
    const from = sanitizeValue(field.from, hiddenKeys);
    const to = sanitizeValue(field.to, hiddenKeys);

    return stable(from) === stable(to) ? null : { ...field, from, to };
};

export const sanitizeActivityChanges = (
    changes: Record<string, any>,
    privacy: ActivityPrivacyMap = {},
) => {
    if (!Array.isArray(changes?.fields)) return changes;

    return {
        ...changes,
        fields: changes.fields
            .map((field: ActivityFieldChange) => sanitizeActivityFieldChange(field, privacy))
            .filter((field: ActivityFieldChange | null): field is ActivityFieldChange => field !== null),
    };
};
