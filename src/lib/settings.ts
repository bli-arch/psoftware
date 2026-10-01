import { get, writable } from "svelte/store";

import { apiGet, apiPatch } from "$lib/api";

export type TrackingLabelFieldSource = "Par défaut" | "Opération" | "Client";

export type TrackingLabelFieldSetting = {
    id: string;
    label: string;
    source: TrackingLabelFieldSource;
    page?: string;
    wide?: boolean;
    showLabel?: boolean;
    dateFormat?: string;
};

export const DEFAULT_TRACKING_LABEL_FIELDS: TrackingLabelFieldSetting[] = [
    {
        id: "system:barcode",
        label: "Code-barres",
        source: "Par défaut",
        wide: true,
        showLabel: false,
    },
];

export type AppSettingsValue = {
    operation: {
        notesEnabled: boolean;
        notesMarkdownEnabled: boolean;
        operationActivityEnabled: boolean;
        operationName: string;
        operationIcon: string;
    };
    clients: {
        activity: boolean;
    };
    team: {
        badgeLoginEnabled: boolean;
        maxSessionHours: number;
        minPasswordLength: number;
    };
    server: {
        rateLimitEnabled: boolean;
        rateLimitRequestsPerMinute: number;
        backupEnabled: boolean;
        backupFrequency: "daily" | "weekly" | "monthly";
        backupDestination: string;
        logFragmentationMode: "duration" | "size";
        logFragmentDuration: "daily" | "weekly" | "monthly";
        logFragmentSizeMB: number;
    };
    documents: {
        receiptsEnabled: boolean;
        autoReceiptOnOperationCreate: boolean;
        invoicesEnabled: boolean;
        receiptPrefix: string;
        receiptFormat: "a4" | "80mm";
        receiptTerms: string;
        receiptFooterNote: string;
        invoicePrefix: string;
        creditNotePrefix: string;
        defaultPaymentDelayDays: number;
        documentLogo: boolean;
        documentFont: "helvetica" | "times" | "courier";
        documentAccentColor: string;
        documentFooter: string;
        receiptShowClient: boolean;
        receiptShowOperation: boolean;
        receiptShowEstimate: boolean;
        receiptShowDeposit: boolean;
        receiptShowTerms: boolean;
        trackingLabelEnabled: boolean;
        trackingLabelPrefix: string;
        trackingLabelWidthMm: number;
        trackingLabelHeightMm: number;
        trackingLabelFields: TrackingLabelFieldSetting[];
        showVerificationHash: boolean;
        autoPdf: boolean;
        immutableIssuedDocuments: boolean;
    };
};

export type AppSettingValueByKey = {
    notesEnabled: boolean;
    notesMarkdownEnabled: boolean;
    operationActivityEnabled: boolean;
    operationName: string;
    operationIcon: string;
    activity: boolean;
    badgeLoginEnabled: boolean;
    maxSessionHours: number;
    minPasswordLength: number;
    rateLimitEnabled: boolean;
    rateLimitRequestsPerMinute: number;
    backupEnabled: boolean;
    backupFrequency: "daily" | "weekly" | "monthly";
    backupDestination: string;
    logFragmentationMode: "duration" | "size";
    logFragmentDuration: "daily" | "weekly" | "monthly";
    logFragmentSizeMB: number;
    receiptsEnabled: boolean;
    autoReceiptOnOperationCreate: boolean;
    invoicesEnabled: boolean;
    receiptPrefix: string;
    receiptFormat: "a4" | "80mm";
    receiptTerms: string;
    receiptFooterNote: string;
    invoicePrefix: string;
    creditNotePrefix: string;
    defaultPaymentDelayDays: number;
    documentLogo: boolean;
    documentFont: "helvetica" | "times" | "courier";
    documentAccentColor: string;
    documentFooter: string;
    receiptShowClient: boolean;
    receiptShowOperation: boolean;
    receiptShowEstimate: boolean;
    receiptShowDeposit: boolean;
    receiptShowTerms: boolean;
    trackingLabelEnabled: boolean;
    trackingLabelPrefix: string;
    trackingLabelWidthMm: number;
    trackingLabelHeightMm: number;
    trackingLabelFields: TrackingLabelFieldSetting[];
    showVerificationHash: boolean;
    autoPdf: boolean;
    immutableIssuedDocuments: boolean;
};

export type AppSettingKey = keyof AppSettingValueByKey;
export type PublicAppSettingKey = "badgeLoginEnabled";

type AppSettingsState = {
    loaded: boolean;
    loading: boolean;
    version: number | null;
    value: AppSettingsValue;
};

export const DEFAULT_SETTINGS: AppSettingsValue = {
    operation: {
        notesEnabled: true,
        notesMarkdownEnabled: true,
        operationActivityEnabled: true,
        operationName: "Opération",
        operationIcon: "Bolt",
    },
    clients: {
        activity: true,
    },
    team: {
        badgeLoginEnabled: true,
        maxSessionHours: 24 * 7,
        minPasswordLength: 8,
    },
    server: {
        rateLimitEnabled: true,
        rateLimitRequestsPerMinute: 300,
        backupEnabled: false,
        backupFrequency: "daily",
        backupDestination: "",
        logFragmentationMode: "duration",
        logFragmentDuration: "monthly",
        logFragmentSizeMB: 50,
    },
    documents: {
        receiptsEnabled: true,
        autoReceiptOnOperationCreate: false,
        invoicesEnabled: true,
        receiptPrefix: "REC-%D<%Y>%-%5N%",
        receiptFormat: "a4",
        receiptTerms: "Ce document atteste la remise de l’appareil et des accessoires mentionnés. Le client autorise les opérations nécessaires au diagnostic et reconnaît qu’une intervention peut entraîner une perte de données. Ce reçu ne constitue ni un devis définitif ni une facture.",
        receiptFooterNote: "Conservez ce reçu : sa référence pourra être demandée lors de la restitution de l’appareil.",
        invoicePrefix: "FAC-%Y-%5N",
        creditNotePrefix: "AV-%Y-%5N",
        defaultPaymentDelayDays: 30,
        documentLogo: true,
        documentFont: "helvetica",
        documentAccentColor: "#111827",
        documentFooter: "",
        receiptShowClient: true,
        receiptShowOperation: true,
        receiptShowEstimate: true,
        receiptShowDeposit: true,
        receiptShowTerms: true,
        trackingLabelEnabled: false,
        trackingLabelPrefix: "ETQ-%D<%Y>%-%5N%",
        trackingLabelWidthMm: 50,
        trackingLabelHeightMm: 30,
        trackingLabelFields: structuredClone(DEFAULT_TRACKING_LABEL_FIELDS),
        showVerificationHash: true,
        autoPdf: true,
        immutableIssuedDocuments: true,
    },
};

const SETTING_DEFAULTS_BY_KEY: AppSettingValueByKey = {
    notesEnabled: DEFAULT_SETTINGS.operation.notesEnabled,
    notesMarkdownEnabled: DEFAULT_SETTINGS.operation.notesMarkdownEnabled,
    operationActivityEnabled: DEFAULT_SETTINGS.operation.operationActivityEnabled,
    operationName: DEFAULT_SETTINGS.operation.operationName,
    operationIcon: DEFAULT_SETTINGS.operation.operationIcon,
    activity: DEFAULT_SETTINGS.clients.activity,
    badgeLoginEnabled: DEFAULT_SETTINGS.team.badgeLoginEnabled,
    maxSessionHours: DEFAULT_SETTINGS.team.maxSessionHours,
    minPasswordLength: DEFAULT_SETTINGS.team.minPasswordLength,
    rateLimitEnabled: DEFAULT_SETTINGS.server.rateLimitEnabled,
    rateLimitRequestsPerMinute: DEFAULT_SETTINGS.server.rateLimitRequestsPerMinute,
    backupEnabled: DEFAULT_SETTINGS.server.backupEnabled,
    backupFrequency: DEFAULT_SETTINGS.server.backupFrequency,
    backupDestination: DEFAULT_SETTINGS.server.backupDestination,
    logFragmentationMode: DEFAULT_SETTINGS.server.logFragmentationMode,
    logFragmentDuration: DEFAULT_SETTINGS.server.logFragmentDuration,
    logFragmentSizeMB: DEFAULT_SETTINGS.server.logFragmentSizeMB,
    receiptsEnabled: DEFAULT_SETTINGS.documents.receiptsEnabled,
    autoReceiptOnOperationCreate: DEFAULT_SETTINGS.documents.autoReceiptOnOperationCreate,
    invoicesEnabled: DEFAULT_SETTINGS.documents.invoicesEnabled,
    receiptPrefix: DEFAULT_SETTINGS.documents.receiptPrefix,
    receiptFormat: DEFAULT_SETTINGS.documents.receiptFormat,
    receiptTerms: DEFAULT_SETTINGS.documents.receiptTerms,
    receiptFooterNote: DEFAULT_SETTINGS.documents.receiptFooterNote,
    invoicePrefix: DEFAULT_SETTINGS.documents.invoicePrefix,
    creditNotePrefix: DEFAULT_SETTINGS.documents.creditNotePrefix,
    defaultPaymentDelayDays: DEFAULT_SETTINGS.documents.defaultPaymentDelayDays,
    documentLogo: DEFAULT_SETTINGS.documents.documentLogo,
    documentFont: DEFAULT_SETTINGS.documents.documentFont,
    documentAccentColor: DEFAULT_SETTINGS.documents.documentAccentColor,
    documentFooter: DEFAULT_SETTINGS.documents.documentFooter,
    receiptShowClient: DEFAULT_SETTINGS.documents.receiptShowClient,
    receiptShowOperation: DEFAULT_SETTINGS.documents.receiptShowOperation,
    receiptShowEstimate: DEFAULT_SETTINGS.documents.receiptShowEstimate,
    receiptShowDeposit: DEFAULT_SETTINGS.documents.receiptShowDeposit,
    receiptShowTerms: DEFAULT_SETTINGS.documents.receiptShowTerms,
    trackingLabelEnabled: DEFAULT_SETTINGS.documents.trackingLabelEnabled,
    trackingLabelPrefix: DEFAULT_SETTINGS.documents.trackingLabelPrefix,
    trackingLabelWidthMm: DEFAULT_SETTINGS.documents.trackingLabelWidthMm,
    trackingLabelHeightMm: DEFAULT_SETTINGS.documents.trackingLabelHeightMm,
    trackingLabelFields: DEFAULT_SETTINGS.documents.trackingLabelFields,
    showVerificationHash: DEFAULT_SETTINGS.documents.showVerificationHash,
    autoPdf: DEFAULT_SETTINGS.documents.autoPdf,
    immutableIssuedDocuments: DEFAULT_SETTINGS.documents.immutableIssuedDocuments,
};

type DeepPartial<T> = {
    [K in keyof T]?: T[K] extends Record<string, unknown> ? Partial<T[K]> : T[K];
};

export const appSettings = writable<AppSettingsState>({
    loaded: false,
    loading: false,
    version: null,
    value: structuredClone(DEFAULT_SETTINGS),
});

let pendingBootstrap: Promise<AppSettingsState> | null = null;

function hasPrivateSettings(value: unknown) {
    return Boolean(
        value
        && typeof value === "object"
        && "operation" in value
        && "clients" in value
        && "team" in value
        && "server" in value
        && "documents" in value,
    );
}

function trackingLabelFieldSource(id: string): TrackingLabelFieldSource | null {
    if (id.startsWith("system:")) return "Par défaut";
    if (id.startsWith("form:operation:")) return "Opération";
    if (id.startsWith("form:client:")) return "Client";
    return null;
}

export function normalizeTrackingLabelFieldSettings(value: unknown): TrackingLabelFieldSetting[] {
    if (!Array.isArray(value)) return structuredClone(DEFAULT_TRACKING_LABEL_FIELDS);

    const seen = new Set<string>();
    return value.slice(0, 64).flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const candidate = item as Record<string, unknown>;
        const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
        const source = trackingLabelFieldSource(id);
        const validSystemId = /^system:(barcode|identifier|status|date)$/.test(id);
        const validFormId = /^form:(operation|client):[^\r\n]{1,120}$/.test(id);
        if ((!validSystemId && !validFormId) || !source || seen.has(id)) return [];

        const rawLabel = typeof candidate.label === "string" ? candidate.label.trim() : "";
        const label = rawLabel.slice(0, 120) || id.slice(0, 120);
        const page = typeof candidate.page === "string" && candidate.page.trim()
            ? candidate.page.trim().slice(0, 80)
            : undefined;
        const dateFormat = id === "system:date"
            && typeof candidate.dateFormat === "string"
            && candidate.dateFormat.trim()
            ? candidate.dateFormat.trim().slice(0, 60)
            : undefined;
        seen.add(id);

        return [{
            id,
            label,
            source,
            ...(page ? { page } : {}),
            wide: id === "system:barcode" ? true : Boolean(candidate.wide),
            showLabel: id === "system:barcode" ? false : candidate.showLabel !== false,
            ...(dateFormat ? { dateFormat } : {}),
        }];
    });
}

function normalizeValue(value: unknown): AppSettingsValue {
    const source = value && typeof value === "object"
        ? value as { operation?: unknown; clients?: unknown; team?: unknown; server?: unknown; documents?: unknown }
        : {};
    const operation = source.operation && typeof source.operation === "object"
        ? source.operation as Record<string, unknown>
        : {};
    const clients = source.clients && typeof source.clients === "object"
        ? source.clients as Record<string, unknown>
        : {};
    const team = source.team && typeof source.team === "object"
        ? source.team as Record<string, unknown>
        : {};
    const server = source.server && typeof source.server === "object"
        ? source.server as Record<string, unknown>
        : {};
    const documents = source.documents && typeof source.documents === "object"
        ? source.documents as Record<string, unknown>
        : {};

    return {
        operation: {
            notesEnabled: typeof operation.notesEnabled === "boolean"
                ? operation.notesEnabled
                : DEFAULT_SETTINGS.operation.notesEnabled,
            notesMarkdownEnabled: typeof operation.notesMarkdownEnabled === "boolean"
                ? operation.notesMarkdownEnabled
                : DEFAULT_SETTINGS.operation.notesMarkdownEnabled,
            operationActivityEnabled: typeof operation.operationActivityEnabled === "boolean"
                ? operation.operationActivityEnabled
                : DEFAULT_SETTINGS.operation.operationActivityEnabled,
            operationName: typeof operation.operationName === "string" && operation.operationName.trim()
                ? operation.operationName.trim()
                : DEFAULT_SETTINGS.operation.operationName,
            operationIcon: typeof operation.operationIcon === "string" && operation.operationIcon.trim()
                ? operation.operationIcon.trim()
                : DEFAULT_SETTINGS.operation.operationIcon,
        },
        clients: {
            activity: typeof clients.activity === "boolean"
                ? clients.activity
                : DEFAULT_SETTINGS.clients.activity,
        },
        team: {
            badgeLoginEnabled: typeof team.badgeLoginEnabled === "boolean"
                ? team.badgeLoginEnabled
                : DEFAULT_SETTINGS.team.badgeLoginEnabled,
            maxSessionHours: typeof team.maxSessionHours === "number"
                ? team.maxSessionHours
                : DEFAULT_SETTINGS.team.maxSessionHours,
            minPasswordLength: typeof team.minPasswordLength === "number"
                ? team.minPasswordLength
                : DEFAULT_SETTINGS.team.minPasswordLength,
        },
        server: {
            rateLimitEnabled: typeof server.rateLimitEnabled === "boolean"
                ? server.rateLimitEnabled
                : DEFAULT_SETTINGS.server.rateLimitEnabled,
            rateLimitRequestsPerMinute: typeof server.rateLimitRequestsPerMinute === "number"
                ? server.rateLimitRequestsPerMinute
                : DEFAULT_SETTINGS.server.rateLimitRequestsPerMinute,
            backupEnabled: false,
            backupFrequency: server.backupFrequency === "weekly" || server.backupFrequency === "monthly"
                ? server.backupFrequency
                : DEFAULT_SETTINGS.server.backupFrequency,
            backupDestination: typeof server.backupDestination === "string"
                ? server.backupDestination
                : DEFAULT_SETTINGS.server.backupDestination,
            logFragmentationMode: server.logFragmentationMode === "size"
                ? server.logFragmentationMode
                : DEFAULT_SETTINGS.server.logFragmentationMode,
            logFragmentDuration: server.logFragmentDuration === "daily" || server.logFragmentDuration === "weekly"
                ? server.logFragmentDuration
                : DEFAULT_SETTINGS.server.logFragmentDuration,
            logFragmentSizeMB: typeof server.logFragmentSizeMB === "number"
                ? server.logFragmentSizeMB
                : DEFAULT_SETTINGS.server.logFragmentSizeMB,
        },
        documents: {
            receiptsEnabled: typeof documents.receiptsEnabled === "boolean"
                ? documents.receiptsEnabled
                : DEFAULT_SETTINGS.documents.receiptsEnabled,
            autoReceiptOnOperationCreate: typeof documents.autoReceiptOnOperationCreate === "boolean"
                ? documents.autoReceiptOnOperationCreate
                : DEFAULT_SETTINGS.documents.autoReceiptOnOperationCreate,
            invoicesEnabled: typeof documents.invoicesEnabled === "boolean"
                ? documents.invoicesEnabled
                : DEFAULT_SETTINGS.documents.invoicesEnabled,
            receiptPrefix: typeof documents.receiptPrefix === "string" && documents.receiptPrefix.trim()
                ? documents.receiptPrefix.trim()
                : DEFAULT_SETTINGS.documents.receiptPrefix,
            receiptFormat: documents.receiptFormat === "80mm"
                ? documents.receiptFormat
                : DEFAULT_SETTINGS.documents.receiptFormat,
            receiptTerms: typeof documents.receiptTerms === "string"
                ? documents.receiptTerms
                : DEFAULT_SETTINGS.documents.receiptTerms,
            receiptFooterNote: typeof documents.receiptFooterNote === "string"
                ? documents.receiptFooterNote
                : DEFAULT_SETTINGS.documents.receiptFooterNote,
            invoicePrefix: typeof documents.invoicePrefix === "string" && documents.invoicePrefix.trim()
                ? documents.invoicePrefix.trim()
                : DEFAULT_SETTINGS.documents.invoicePrefix,
            creditNotePrefix: typeof documents.creditNotePrefix === "string" && documents.creditNotePrefix.trim()
                ? documents.creditNotePrefix.trim()
                : DEFAULT_SETTINGS.documents.creditNotePrefix,
            defaultPaymentDelayDays: typeof documents.defaultPaymentDelayDays === "number"
                ? documents.defaultPaymentDelayDays
                : DEFAULT_SETTINGS.documents.defaultPaymentDelayDays,
            documentLogo: typeof documents.documentLogo === "boolean"
                ? documents.documentLogo
                : DEFAULT_SETTINGS.documents.documentLogo,
            documentFont: documents.documentFont === "times" || documents.documentFont === "courier"
                ? documents.documentFont
                : DEFAULT_SETTINGS.documents.documentFont,
            documentAccentColor: typeof documents.documentAccentColor === "string" && /^#[0-9A-Fa-f]{6}$/.test(documents.documentAccentColor)
                ? documents.documentAccentColor
                : DEFAULT_SETTINGS.documents.documentAccentColor,
            documentFooter: typeof documents.documentFooter === "string"
                ? documents.documentFooter
                : DEFAULT_SETTINGS.documents.documentFooter,
            receiptShowClient: typeof documents.receiptShowClient === "boolean"
                ? documents.receiptShowClient
                : DEFAULT_SETTINGS.documents.receiptShowClient,
            receiptShowOperation: typeof documents.receiptShowOperation === "boolean"
                ? documents.receiptShowOperation
                : DEFAULT_SETTINGS.documents.receiptShowOperation,
            receiptShowEstimate: typeof documents.receiptShowEstimate === "boolean"
                ? documents.receiptShowEstimate
                : DEFAULT_SETTINGS.documents.receiptShowEstimate,
            receiptShowDeposit: typeof documents.receiptShowDeposit === "boolean"
                ? documents.receiptShowDeposit
                : DEFAULT_SETTINGS.documents.receiptShowDeposit,
            receiptShowTerms: typeof documents.receiptShowTerms === "boolean"
                ? documents.receiptShowTerms
                : DEFAULT_SETTINGS.documents.receiptShowTerms,
            trackingLabelEnabled: typeof documents.trackingLabelEnabled === "boolean"
                ? documents.trackingLabelEnabled
                : DEFAULT_SETTINGS.documents.trackingLabelEnabled,
            trackingLabelPrefix: typeof documents.trackingLabelPrefix === "string" && documents.trackingLabelPrefix.trim()
                ? documents.trackingLabelPrefix.trim()
                : DEFAULT_SETTINGS.documents.trackingLabelPrefix,
            trackingLabelWidthMm: typeof documents.trackingLabelWidthMm === "number" && Number.isFinite(documents.trackingLabelWidthMm)
                ? Math.min(200, Math.max(15, documents.trackingLabelWidthMm))
                : DEFAULT_SETTINGS.documents.trackingLabelWidthMm,
            trackingLabelHeightMm: typeof documents.trackingLabelHeightMm === "number" && Number.isFinite(documents.trackingLabelHeightMm)
                ? Math.min(200, Math.max(15, documents.trackingLabelHeightMm))
                : DEFAULT_SETTINGS.documents.trackingLabelHeightMm,
            trackingLabelFields: normalizeTrackingLabelFieldSettings(documents.trackingLabelFields),
            showVerificationHash: typeof documents.showVerificationHash === "boolean"
                ? documents.showVerificationHash
                : DEFAULT_SETTINGS.documents.showVerificationHash,
            autoPdf: typeof documents.autoPdf === "boolean"
                ? documents.autoPdf
                : DEFAULT_SETTINGS.documents.autoPdf,
            immutableIssuedDocuments: typeof documents.immutableIssuedDocuments === "boolean"
                ? documents.immutableIssuedDocuments
                : DEFAULT_SETTINGS.documents.immutableIssuedDocuments,
        },
    };
}

function normalizeSettingValue<K extends AppSettingKey>(key: K, value: unknown): AppSettingValueByKey[K] {
    if (key === "backupEnabled") return false as AppSettingValueByKey[K];
    if (key === "trackingLabelFields") {
        return normalizeTrackingLabelFieldSettings(value) as AppSettingValueByKey[K];
    }
    if (
        key === "operationName"
        || key === "operationIcon"
        || key === "receiptPrefix"
        || key === "receiptFormat"
        || key === "receiptTerms"
        || key === "receiptFooterNote"
        || key === "trackingLabelPrefix"
        || key === "invoicePrefix"
        || key === "creditNotePrefix"
        || key === "documentFont"
        || key === "documentAccentColor"
        || key === "documentFooter"
        || key === "backupFrequency"
        || key === "backupDestination"
        || key === "logFragmentationMode"
        || key === "logFragmentDuration"
    ) {
        return (typeof value === "string" && value.trim()
            ? value.trim()
            : SETTING_DEFAULTS_BY_KEY[key]) as AppSettingValueByKey[K];
    }
    if (
        key === "maxSessionHours"
        || key === "minPasswordLength"
        || key === "rateLimitRequestsPerMinute"
        || key === "logFragmentSizeMB"
        || key === "defaultPaymentDelayDays"
        || key === "trackingLabelWidthMm"
        || key === "trackingLabelHeightMm"
    ) {
        return (typeof value === "number" ? value : SETTING_DEFAULTS_BY_KEY[key]) as AppSettingValueByKey[K];
    }
    return (typeof value === "boolean" ? value : SETTING_DEFAULTS_BY_KEY[key]) as AppSettingValueByKey[K];
}

function mergeSettingValue<K extends AppSettingKey>(
    key: K,
    value: AppSettingValueByKey[K],
    version: number | null,
) {
    appSettings.update((state) => {
        const nextValue = structuredClone(state.value);

        if (key === "notesEnabled") {
            nextValue.operation.notesEnabled = value as boolean;
        } else if (key === "notesMarkdownEnabled") {
            nextValue.operation.notesMarkdownEnabled = value as boolean;
        } else if (key === "operationActivityEnabled") {
            nextValue.operation.operationActivityEnabled = value as boolean;
        } else if (key === "operationName") {
            nextValue.operation.operationName = value as string;
        } else if (key === "operationIcon") {
            nextValue.operation.operationIcon = value as string;
        } else if (key === "activity") {
            nextValue.clients.activity = value as boolean;
        } else if (key === "badgeLoginEnabled") {
            nextValue.team.badgeLoginEnabled = value as boolean;
        } else if (key === "maxSessionHours") {
            nextValue.team.maxSessionHours = value as number;
        } else if (key === "minPasswordLength") {
            nextValue.team.minPasswordLength = value as number;
        } else if (key === "rateLimitEnabled") {
            nextValue.server.rateLimitEnabled = value as boolean;
        } else if (key === "rateLimitRequestsPerMinute") {
            nextValue.server.rateLimitRequestsPerMinute = value as number;
        } else if (key in nextValue.server) {
            (nextValue.server as unknown as Record<string, unknown>)[key] = value;
        } else if (key in nextValue.documents) {
            (nextValue.documents as Record<string, unknown>)[key] = value;
        }

        return {
            ...state,
            version: version ?? state.version,
            value: nextValue,
        };
    });
}

export function setSettingsSnapshot(response: unknown): AppSettingsState {
    const payload = response && typeof response === "object"
        ? response as { version?: unknown; value?: unknown }
        : {};
    const nextState = {
        loaded: hasPrivateSettings(payload.value),
        loading: false,
        version: Number.isInteger(payload.version) ? payload.version as number : null,
        value: normalizeValue(payload.value),
    };

    appSettings.set(nextState);
    return nextState;
}

export async function bootstrapSettings(force = false) {
    const current = get(appSettings);
    if (!force && current.loaded) return current;
    if (pendingBootstrap) return pendingBootstrap;

    appSettings.update((state) => ({ ...state, loading: true }));
    pendingBootstrap = apiGet("/settings/bootstrap")
        .then(setSettingsSnapshot)
        .catch((error) => {
            appSettings.update((state) => ({ ...state, loading: false }));
            throw error;
        })
        .finally(() => {
            pendingBootstrap = null;
        });

    return pendingBootstrap;
}

export async function updateAppSettings(patch: DeepPartial<AppSettingsValue>) {
    const safePatch = patch.server && "backupEnabled" in patch.server
        ? { ...patch, server: { ...patch.server, backupEnabled: false } }
        : patch;
    const snapshot = await apiPatch("/settings/", safePatch as Record<string, unknown>);
    return setSettingsSnapshot(snapshot);
}

export async function getAppSetting<K extends AppSettingKey>(key: K): Promise<AppSettingValueByKey[K]> {
    const response = await apiGet(`/settings/key/${encodeURIComponent(key)}`);
    const payload = response && typeof response === "object"
        ? response as { version?: unknown; value?: unknown }
        : {};
    const value = normalizeSettingValue(key, payload.value);
    const version = Number.isInteger(payload.version) ? payload.version as number : null;
    mergeSettingValue(key, value, version);
    return value;
}

export async function getPublicAppSetting<K extends PublicAppSettingKey>(key: K): Promise<AppSettingValueByKey[K]> {
    const response = await apiGet(`/settings/public/${encodeURIComponent(key)}`);
    const payload = response && typeof response === "object"
        ? response as { version?: unknown; value?: unknown }
        : {};
    const value = normalizeSettingValue(key, payload.value);
    const version = Number.isInteger(payload.version) ? payload.version as number : null;
    mergeSettingValue(key, value, version);
    return value;
}

export async function refreshSettingsIfStale(version: number) {
    const current = get(appSettings);
    if (!current.loaded) {
        await bootstrapSettings(true);
        return;
    }
    if (current.version === null || current.version === version) return;
    await bootstrapSettings(true);
}
