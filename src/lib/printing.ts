import { browser } from "$app/environment";
import { invoke } from "@tauri-apps/api/core";
import { get, writable } from "svelte/store";

const STORAGE_KEY = "psoftPrintPreferences";
const PRINT_OUTCOME_UNKNOWN_PREFIX = "PRINT_OUTCOME_UNKNOWN:";
export const SYSTEM_PRINTER_VALUE = "psoft://system-printer";
export const PRINT_MAX_PAGE_COUNT = 1_000;
export const PRINT_MIN_PAGE_SIZE_INCHES = 10 / 25.4;

export type PrintColor = "color" | "grayscale";
export type PrintOrientation = "portrait" | "landscape";
export type PrintPaperSize = "document" | "a4" | "a5" | "letter";
export type PrintJobType = "document" | "tracking-label";
export type PrintJobMode = "manual" | "automatic";
export type PrintPresentation = "direct" | "panel" | "unknown";
export type PrintFailureAction = "panel" | "retry" | "unknown";

export const PRINT_PAPER_SIZES: Record<Exclude<PrintPaperSize, "document">, { width: number; height: number }> = {
    a4: { width: 210 / 25.4, height: 297 / 25.4 },
    a5: { width: 148 / 25.4, height: 210 / 25.4 },
    letter: { width: 8.5, height: 11 },
};

export type PrintMargins = {
    top: number;
    right: number;
    bottom: number;
    left: number;
};

export type PrintRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type PrintPageRange = {
    start: number;
    end: number;
};

export type PrintDefaults = {
    copies: number;
    color: PrintColor;
    orientation: PrintOrientation;
    paperSize: PrintPaperSize;
    duplex: boolean;
};

export type PrintPreferences = {
    printerName: string;
    direct: boolean;
    defaults: PrintDefaults;
};

export type PrinterInfo = {
    name: string;
    isDefault: boolean;
};

export type PrinterPaperSize = {
    name: string;
    width: number;
    height: number;
};

export type PrinterCapabilities = {
    supportsColor: boolean | null;
    supportsDuplex: boolean | null;
    paperSizes: PrinterPaperSize[];
    pageSizeSupported: boolean;
    printableArea: PrintRect | null;
};

export type PrintJob = {
    type: PrintJobType;
    mode: PrintJobMode;
    kind: "pdf" | "text";
    title: string;
    description?: string;
    data?: ArrayBuffer;
    content?: string;
    orientation?: PrintOrientation;
    paperSize?: PrintPaperSize;
};

export type PrintRequest = PrintJob & {
    id: number;
    presentation: PrintPresentation;
};

export type PrintDocumentMeta = {
    pageCount: number;
    width: number;
    height: number;
};

export type NativePrintOptions = {
    printerName: string;
    copies: number;
    color: PrintColor;
    orientation: PrintOrientation;
    duplex: boolean;
    pageWidth: number;
    pageHeight: number;
    margins: PrintMargins;
    pageRanges: string;
};

export const DEFAULT_PRINT_PREFERENCES: PrintPreferences = {
    printerName: "",
    direct: false,
    defaults: {
        copies: 1,
        color: "color",
        orientation: "portrait",
        paperSize: "document",
        duplex: false,
    },
};

function normalizePreferences(value: unknown): PrintPreferences {
    const source = value && typeof value === "object" ? value as Partial<PrintPreferences> : {};
    const defaults = source.defaults && typeof source.defaults === "object"
        ? source.defaults as Partial<PrintDefaults>
        : {};
    const copies = typeof defaults.copies === "number" && Number.isFinite(defaults.copies)
        ? Math.min(99, Math.max(1, Math.round(defaults.copies)))
        : DEFAULT_PRINT_PREFERENCES.defaults.copies;

    return {
        printerName: typeof source.printerName === "string"
            ? source.printerName.slice(0, 260)
            : DEFAULT_PRINT_PREFERENCES.printerName,
        direct: typeof source.direct === "boolean" ? source.direct : DEFAULT_PRINT_PREFERENCES.direct,
        defaults: {
            copies,
            color: defaults.color === "grayscale" ? "grayscale" : "color",
            orientation: defaults.orientation === "landscape" ? "landscape" : "portrait",
            paperSize: defaults.paperSize === "a4"
                || defaults.paperSize === "a5"
                || defaults.paperSize === "letter"
                ? defaults.paperSize
                : "document",
            duplex: typeof defaults.duplex === "boolean" ? defaults.duplex : false,
        },
    };
}

function loadPreferences() {
    if (!browser) return normalizePreferences(null);
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return normalizePreferences(stored ? JSON.parse(stored) : null);
    } catch {
        return normalizePreferences(null);
    }
}

export const printPreferences = writable<PrintPreferences>(loadPreferences());

if (browser) {
    printPreferences.subscribe((value) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizePreferences(value)));
        } catch (error) {
            console.error("Failed to save print preferences", error);
        }
    });
}

export function updatePrintPreferences(value: PrintPreferences) {
    printPreferences.set(normalizePreferences(value));
}

export function resetPrintPreferences() {
    printPreferences.set(normalizePreferences(null));
}

export function initialPrintPresentation(job: Pick<PrintJob, "type" | "mode">, documentDirect: boolean): PrintPresentation {
    if (job.type === "tracking-label") return job.mode === "automatic" ? "direct" : "panel";
    return documentDirect ? "direct" : "panel";
}

export function resolvePrintJobPrinter(
    job: Pick<PrintJob, "type">,
    documentPrinter: string,
    trackingLabelPrinter: string,
) {
    if (job.type === "tracking-label") return trackingLabelPrinter;
    return documentPrinter || SYSTEM_PRINTER_VALUE;
}

export function resolveNativePrinterName(selection: string) {
    return selection === SYSTEM_PRINTER_VALUE ? "" : selection;
}

export function printerSelectionAvailable(selection: string, printers: PrinterInfo[]) {
    return selection === SYSTEM_PRINTER_VALUE
        ? printers.some((printer) => printer.isDefault)
        : printers.some((printer) => printer.name === selection);
}

export function printErrorMessage(error: unknown) {
    const message = typeof error === "string"
        ? error
        : error instanceof Error ? error.message : "Impossible d’imprimer ce document.";
    return message.startsWith(PRINT_OUTCOME_UNKNOWN_PREFIX)
        ? message.slice(PRINT_OUTCOME_UNKNOWN_PREFIX.length)
        : message;
}

export function printFailureAction(direct: boolean, error: unknown): PrintFailureAction {
    const message = typeof error === "string" ? error : error instanceof Error ? error.message : "";
    if (message.startsWith(PRINT_OUTCOME_UNKNOWN_PREFIX)) return "unknown";
    return direct ? "panel" : "retry";
}

export function createPrintQueue(documentDirect: () => boolean = () => false) {
    const request = writable<PrintRequest | null>(null);
    const pending: PrintRequest[] = [];
    let active: PrintRequest | null = null;
    let nextRequestId = 0;

    function enqueue(job: PrintJob) {
        if (job.type !== "document" && job.type !== "tracking-label") return false;
        if (job.mode !== "manual" && job.mode !== "automatic") return false;
        if (typeof job.title !== "string") return false;
        if (job.kind === "pdf" && !(job.data instanceof ArrayBuffer)) return false;
        if (job.kind === "text" && typeof job.content !== "string") return false;

        pending.push({
            type: job.type,
            mode: job.mode,
            kind: job.kind,
            title: job.title,
            description: job.description,
            data: job.data,
            content: job.content,
            orientation: job.orientation,
            paperSize: job.paperSize,
            id: ++nextRequestId,
            presentation: initialPrintPresentation(job, documentDirect()),
        });
        if (!active) {
            active = pending.shift() ?? null;
            request.set(active);
        }
        return true;
    }

    function showPanel(id: number) {
        if (!active || active.id !== id || active.presentation === "panel") return false;
        active = { ...active, presentation: "panel" };
        request.set(active);
        return true;
    }

    function markUnknown(id: number) {
        if (!active || active.id !== id || active.presentation === "unknown") return false;
        active = { ...active, presentation: "unknown" };
        request.set(active);
        return true;
    }

    function release(id: number) {
        if (!active || active.id !== id) return false;
        active = pending.shift() ?? null;
        request.set(active);
        return true;
    }

    return { request, enqueue, showPanel, markUnknown, release };
}

const printQueue = createPrintQueue(() => get(printPreferences).direct);
export const printRequest = printQueue.request;
export const requestPrint = printQueue.enqueue;
export const showPrintRequestPanel = printQueue.showPanel;
export const markPrintRequestUnknown = printQueue.markUnknown;
export const releasePrintRequest = printQueue.release;

export function parsePageRanges(
    value: string,
    pageCount: number,
    allowEmpty = true,
): PrintPageRange[] | null {
    if (!Number.isSafeInteger(pageCount) || pageCount < 1 || value.length > 100) return null;
    if (!value.trim()) return allowEmpty ? [{ start: 1, end: pageCount }] : null;

    const ranges: PrintPageRange[] = [];
    for (const part of value.replaceAll(" ", "").split(",")) {
        const match = /^(\d+)(?:-(\d+))?$/.exec(part);
        if (!match) return null;
        const start = Number(match[1]);
        const end = Number(match[2] ?? match[1]);
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)
            || start < 1 || start > end || end > pageCount) return null;
        ranges.push({ start, end });
    }

    ranges.sort((left, right) => left.start - right.start || left.end - right.end);
    return ranges.reduce<PrintPageRange[]>((merged, range) => {
        const previous = merged.at(-1);
        if (previous && range.start <= previous.end + 1) {
            previous.end = Math.max(previous.end, range.end);
        } else {
            merged.push({ ...range });
        }
        return merged;
    }, []);
}

export function formatPageRanges(ranges: PrintPageRange[]) {
    return ranges
        .map(({ start, end }) => start === end ? String(start) : `${start}-${end}`)
        .join(",");
}

export function countPages(ranges: PrintPageRange[]) {
    return ranges.reduce((total, { start, end }) => total + end - start + 1, 0);
}

export async function listInstalledPrinters() {
    if (!browser || !("__TAURI_INTERNALS__" in window)) return [];
    return invoke<PrinterInfo[]>("list_printers");
}

export async function getPrinterCapabilities(
    printerName: string,
    pageWidth: number,
    pageHeight: number,
    orientation: PrintOrientation,
    color: PrintColor,
    duplex: boolean,
) {
    if (!browser || !("__TAURI_INTERNALS__" in window)) return null;
    return invoke<PrinterCapabilities>("get_printer_capabilities", {
        printerName,
        pageWidth,
        pageHeight,
        orientation,
        color,
        duplex,
    });
}

export async function sendToPrinter(options: NativePrintOptions) {
    if (!browser || !("__TAURI_INTERNALS__" in window)) {
        throw new Error("L’impression native est uniquement disponible dans l’application de bureau.");
    }
    await invoke("print_document", { options });
}
