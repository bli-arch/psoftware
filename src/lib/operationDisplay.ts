import { DEFAULT_SETTINGS, type AppSettingsValue } from "$lib/settings";

type OperationSettings = AppSettingsValue["operation"];

function cleanName(settings?: Partial<OperationSettings>) {
    return settings?.operationName?.trim() || DEFAULT_SETTINGS.operation.operationName;
}

export function operationSingular(settings?: Partial<OperationSettings>) {
    return cleanName(settings);
}

export function operationPlural(settings?: Partial<OperationSettings>) {
    const name = cleanName(settings);
    return /[sxz]$/i.test(name) ? name : `${name}s`;
}

export function lowerFirst(value: string) {
    return value ? `${value.charAt(0).toLocaleLowerCase("fr-FR")}${value.slice(1)}` : value;
}

export function operationSingularLower(settings?: Partial<OperationSettings>) {
    return lowerFirst(operationSingular(settings));
}

export function operationPluralLower(settings?: Partial<OperationSettings>) {
    return lowerFirst(operationPlural(settings));
}
