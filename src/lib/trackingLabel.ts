import { browser } from "$app/environment";
import { SYSTEM_PRINTER_VALUE, type PrintJob, type PrintJobMode } from "$lib/printing";
import type { TrackingLabelFieldSetting } from "$lib/settings";
import { strftime } from "$lib/utils";

export type TrackingLabelField = TrackingLabelFieldSetting & {
    sample: string;
    enabled: boolean;
};

const TRACKING_LABEL_PRINTER_STORAGE_KEY = "psoftTrackingLabelPrinter";
const LEGACY_TRACKING_LABEL_PRINTER_STORAGE_KEY = "psoftStickerPrinter";
const TRACKING_LABEL_AUTOMATIC_PRINT_STORAGE_KEY = "psoftTrackingLabelAutomaticPrint";

const CODE128_PATTERNS = [
    "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212",
    "221213", "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221",
    "223211", "221132", "221231", "213212", "223112", "312131", "311222", "321122", "321221",
    "312212", "322112", "322211", "212123", "212321", "232121", "111323", "131123", "131321",
    "112313", "132113", "132311", "211313", "231113", "231311", "112133", "112331", "132131",
    "113123", "113321", "133121", "313121", "211331", "231131", "213113", "213311", "213131",
    "311123", "311321", "331121", "312113", "312311", "332111", "314111", "221411", "431111",
    "111224", "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114",
    "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", "111242",
    "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
    "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311",
    "113141", "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];

export function code128(value: string) {
    const values = [...value].map((character) => {
        const code = character.charCodeAt(0);
        return code >= 32 && code <= 126 ? code - 32 : 31;
    });
    const checksum = (104 + values.reduce((total, code, index) => total + code * (index + 1), 0)) % 103;
    const patterns = [104, ...values, checksum, 106].map((code) => CODE128_PATTERNS[code]);
    const bars: Array<{ x: number; width: number }> = [];
    let x = 10;

    for (const pattern of patterns) {
        [...pattern].forEach((moduleWidth, index) => {
            const width = Number(moduleWidth);
            if (index % 2 === 0) bars.push({ x, width });
            x += width;
        });
    }

    return { bars, width: x + 10 };
}

function trackingLabelRows(items: TrackingLabelField[]) {
    const rows: TrackingLabelField[][] = [];
    let pending: TrackingLabelField[] = [];

    for (const field of items) {
        if (field.id === "system:barcode" || field.wide) {
            if (pending.length) rows.push(pending);
            rows.push([field]);
            pending = [];
            continue;
        }

        pending.push(field);
        if (pending.length === 2) {
            rows.push(pending);
            pending = [];
        }
    }
    if (pending.length) rows.push(pending);
    return rows;
}

function fittedText(context: CanvasRenderingContext2D, value: string, maxWidth: number) {
    if (context.measureText(value).width <= maxWidth) return value;
    let low = 0;
    let high = value.length;
    while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        if (context.measureText(`${value.slice(0, middle)}…`).width <= maxWidth) low = middle;
        else high = middle - 1;
    }
    return `${value.slice(0, low)}…`;
}

function drawTrackingLabel(fields: TrackingLabelField[], width: number, height: number, dpi: number) {
    const pixelsPerMillimeter = dpi / 25.4;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * pixelsPerMillimeter));
    canvas.height = Math.max(1, Math.round(height * pixelsPerMillimeter));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Contexte graphique indisponible");

    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#000";
    context.textBaseline = "top";

    const padding = Math.min(canvas.width * 0.04, canvas.height * 0.05);
    const gap = Math.min(canvas.height * 0.025, canvas.width * 0.018);
    const labelSize = Math.min(canvas.height * 0.042, canvas.width * 0.034);
    const valueSize = Math.min(canvas.height * 0.058, canvas.width * 0.046);
    const valueMargin = Math.min(canvas.height * 0.008, canvas.width * 0.006);
    const barcodeHeight = Math.min(canvas.height * 0.22, canvas.width * 0.11);
    const barcodeTextSize = Math.min(canvas.height * 0.04, canvas.width * 0.032);
    const barcodeTextMargin = Math.min(canvas.height * 0.01, canvas.width * 0.006);
    const labelLineHeight = labelSize * 1.1;
    const valueLineHeight = valueSize * 1.1;
    const barcodeMinimumRowHeight = Math.min(canvas.height * 0.3, canvas.width * 0.13);
    const barcodeContentHeight = barcodeHeight + barcodeTextMargin + barcodeTextSize;
    const rows = trackingLabelRows(fields);
    const rowHeights = rows.map((row) => {
        const firstField = row[0];
        if (firstField?.id === "system:barcode") {
            return Math.max(barcodeMinimumRowHeight, barcodeContentHeight);
        }
        return Math.max(...row.map((field) => (
            (field.showLabel !== false ? labelLineHeight + valueMargin : 0) + valueLineHeight
        )));
    });
    const availableHeight = Math.max(1, canvas.height - padding * 2);
    const intrinsicHeight = rowHeights.reduce((total, rowHeight) => total + rowHeight, 0)
        + gap * Math.max(0, rows.length - 1);
    const contentScale = Math.min(1, availableHeight / Math.max(1, intrinsicHeight));
    const scaledRowHeights = rowHeights.map((rowHeight) => rowHeight * contentScale);
    const scaledGap = gap * contentScale;
    const remainingSpace = Math.max(
        0,
        availableHeight
            - scaledRowHeights.reduce((total, rowHeight) => total + rowHeight, 0)
            - scaledGap * Math.max(0, rows.length - 1),
    );
    const rowGap = rows.length > 1 ? scaledGap + remainingSpace / (rows.length - 1) : 0;
    let top = padding;

    rows.forEach((row, rowIndex) => {
        const rowHeight = scaledRowHeights[rowIndex];
        if (row[0]?.id === "system:barcode") {
            const field = row[0];
            const barcodeValue = field.sample || "0";
            const barcode = code128(barcodeValue);
            const textHeight = barcodeTextSize * contentScale;
            const barHeight = barcodeHeight * contentScale;

            const scale = canvas.width / barcode.width;
            barcode.bars.forEach((bar) => {
                context.fillRect(bar.x * scale, top, Math.max(1, bar.width * scale), barHeight);
            });
            context.font = `700 ${textHeight}px "Red Hat Display", sans-serif`;
            context.textAlign = "center";
            context.fillText(
                fittedText(context, barcodeValue, canvas.width - padding * 2),
                canvas.width / 2,
                top + barHeight + barcodeTextMargin * contentScale,
            );
            context.textAlign = "left";
        } else {
            const columnGap = gap * contentScale;
            const columnWidth = (canvas.width - padding * 2 - columnGap * (row.length - 1)) / row.length;
            row.forEach((field, columnIndex) => {
                const left = padding + columnIndex * (columnWidth + columnGap);
                const scaledLabelSize = labelSize * contentScale;
                const scaledValueSize = valueSize * contentScale;
                let valueTop = top;
                if (field.showLabel !== false) {
                    context.font = `500 ${scaledLabelSize}px "Red Hat Display", sans-serif`;
                    context.fillText(fittedText(context, field.label, columnWidth), left, top);
                    valueTop += scaledLabelSize * 1.1 + valueMargin * contentScale;
                }
                context.font = `700 ${scaledValueSize}px "Red Hat Display", sans-serif`;
                context.fillText(
                    fittedText(context, field.sample, columnWidth),
                    left,
                    valueTop,
                );
            });
        }
        top += rowHeight + rowGap;
    });

    return canvas;
}

function joinBytes(parts: Uint8Array[]) {
    const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
    let offset = 0;
    parts.forEach((part) => {
        result.set(part, offset);
        offset += part.length;
    });
    return result;
}

function pdfFromJpeg(jpeg: Uint8Array, imageWidth: number, imageHeight: number, width: number, height: number) {
    const encode = (value: string) => new TextEncoder().encode(value);
    const pageWidth = width * 72 / 25.4;
    const pageHeight = height * 72 / 25.4;
    const content = encode(`q\n${pageWidth.toFixed(3)} 0 0 ${pageHeight.toFixed(3)} 0 0 cm\n/Im0 Do\nQ`);
    const bodies = [
        encode("<< /Type /Catalog /Pages 2 0 R >>"),
        encode("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
        encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(3)} ${pageHeight.toFixed(3)}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`),
        joinBytes([encode(`<< /Length ${content.length} >>\nstream\n`), content, encode("\nendstream")]),
        joinBytes([
            encode(`<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),
            jpeg,
            encode("\nendstream"),
        ]),
    ];
    const header = encode("%PDF-1.4\n");
    const objects = bodies.map((body, index) => joinBytes([
        encode(`${index + 1} 0 obj\n`),
        body,
        encode("\nendobj\n"),
    ]));
    const offsets: number[] = [];
    let position = header.length;
    objects.forEach((object) => {
        offsets.push(position);
        position += object.length;
    });
    const xref = encode([
        "xref",
        "0 6",
        "0000000000 65535 f ",
        ...offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
        "trailer",
        "<< /Size 6 /Root 1 0 R >>",
        "startxref",
        String(position),
        "%%EOF",
        "",
    ].join("\n"));
    return joinBytes([header, ...objects, xref]).buffer;
}

async function createTrackingLabelImage(
    fields: TrackingLabelField[],
    width: number,
    height: number,
    dpi = 300,
    format: "image/jpeg" | "image/png" = "image/jpeg",
) {
    await document.fonts.load('500 16px "Red Hat Display"');
    await document.fonts.load('700 16px "Red Hat Display"');
    await document.fonts.ready;
    const canvas = drawTrackingLabel(fields, width, height, dpi);
    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            (value) => value ? resolve(value) : reject(new Error("Image indisponible")),
            format,
            format === "image/jpeg" ? 0.96 : undefined,
        );
    });
    return { blob, width: canvas.width, height: canvas.height };
}

export async function createTrackingLabelPreview(fields: TrackingLabelField[], width: number, height: number, dpi: number) {
    return (await createTrackingLabelImage(fields, width, height, dpi, "image/png")).blob;
}

export async function createTrackingLabelPdf(fields: TrackingLabelField[], width: number, height: number) {
    const image = await createTrackingLabelImage(fields, width, height);
    return pdfFromJpeg(
        new Uint8Array(await image.blob.arrayBuffer()),
        image.width,
        image.height,
        width,
        height,
    );
}

export function loadTrackingLabelPrinter() {
    if (!browser) return SYSTEM_PRINTER_VALUE;
    try {
        return (localStorage.getItem(TRACKING_LABEL_PRINTER_STORAGE_KEY)
            ?? localStorage.getItem(LEGACY_TRACKING_LABEL_PRINTER_STORAGE_KEY))?.slice(0, 260)
            || SYSTEM_PRINTER_VALUE;
    } catch {
        return SYSTEM_PRINTER_VALUE;
    }
}

export function saveTrackingLabelPrinter(value: unknown) {
    const printer = typeof value === "string" && value ? value.slice(0, 260) : SYSTEM_PRINTER_VALUE;
    if (!browser) return printer;
    try {
        if (printer === SYSTEM_PRINTER_VALUE) {
            localStorage.removeItem(TRACKING_LABEL_PRINTER_STORAGE_KEY);
        } else {
            localStorage.setItem(TRACKING_LABEL_PRINTER_STORAGE_KEY, printer);
        }
        localStorage.removeItem(LEGACY_TRACKING_LABEL_PRINTER_STORAGE_KEY);
    } catch (error) {
        console.error("Failed to save tracking label printer", error);
    }
    return printer;
}

export function loadTrackingLabelAutomaticPrint() {
    if (!browser) return false;
    try {
        return localStorage.getItem(TRACKING_LABEL_AUTOMATIC_PRINT_STORAGE_KEY) === "true";
    } catch {
        return false;
    }
}

export function saveTrackingLabelAutomaticPrint(value: boolean) {
    if (!browser) return value;
    try {
        if (value) localStorage.setItem(TRACKING_LABEL_AUTOMATIC_PRINT_STORAGE_KEY, "true");
        else localStorage.removeItem(TRACKING_LABEL_AUTOMATIC_PRINT_STORAGE_KEY);
    } catch (error) {
        console.error("Failed to save automatic tracking label printing", error);
    }
    return value;
}

export function resetTrackingLabelDeviceSettings() {
    if (!browser) return;
    try {
        localStorage.removeItem(TRACKING_LABEL_PRINTER_STORAGE_KEY);
        localStorage.removeItem(LEGACY_TRACKING_LABEL_PRINTER_STORAGE_KEY);
        localStorage.removeItem(TRACKING_LABEL_AUTOMATIC_PRINT_STORAGE_KEY);
    } catch (error) {
        console.error("Failed to reset tracking label device settings", error);
    }
}

export function serializeTrackingLabelFields(fields: TrackingLabelField[]): TrackingLabelFieldSetting[] {
    return fields.filter((field) => field.enabled).map((field) => ({
        id: field.id,
        label: field.label,
        source: field.source,
        ...(field.page ? { page: field.page } : {}),
        wide: field.id === "system:barcode" ? true : Boolean(field.wide),
        showLabel: field.id === "system:barcode" ? false : field.showLabel !== false,
        ...(field.id === "system:date" && field.dateFormat ? { dateFormat: field.dateFormat } : {}),
    }));
}

function record(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function printableValue(value: unknown): string {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "boolean") return value ? "Oui" : "Non";
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (Array.isArray(value)) return value.map(printableValue).join(", ");

    const item = record(value);
    for (const key of ["label", "name", "title", "value"]) {
        if (typeof item[key] === "string" || typeof item[key] === "number") return String(item[key]);
    }
    return "—";
}

export function resolveTrackingLabelFields(
    fields: TrackingLabelFieldSetting[],
    operationValue: unknown,
    clientValue?: unknown,
): TrackingLabelField[] {
    const operation = record(operationValue);
    const operationData = record(operation.data);
    const client = record(clientValue ?? operation.client);
    const clientData = record(client.data);
    const identifier = printableValue(operation.uid ?? operation.id ?? operation.pk);
    const state = record(operation.state);

    return fields.map((field) => {
        let sample: string;
        if (field.id === "system:barcode" || field.id === "system:identifier") {
            sample = identifier;
        } else if (field.id === "system:status") {
            sample = printableValue(state.name ?? operation.state_name ?? operation.stateName ?? operation.state);
        } else if (field.id === "system:date") {
            try {
                sample = strftime(
                    (operation.created_at ?? operation.createdAt ?? new Date()) as Date | string,
                    field.dateFormat ?? "%d/%m/%Y",
                    "fr-FR",
                );
            } catch {
                sample = printableValue(operation.created_at ?? operation.createdAt);
            }
        } else if (field.id.startsWith("form:operation:")) {
            sample = printableValue(operationData[field.id.slice("form:operation:".length)]);
        } else if (field.id.startsWith("form:client:")) {
            sample = printableValue(clientData[field.id.slice("form:client:".length)]);
        } else {
            sample = "—";
        }

        return { ...field, sample, enabled: true };
    });
}

export async function createTrackingLabelPrintJob(
    fields: TrackingLabelFieldSetting[],
    width: number,
    height: number,
    operation: unknown,
    mode: PrintJobMode,
    client?: unknown,
): Promise<PrintJob | null> {
    const resolvedFields = resolveTrackingLabelFields(fields, operation, client);
    if (resolvedFields.length === 0) return null;
    return {
        type: "tracking-label",
        mode,
        kind: "pdf",
        title: "Étiquette de suivi",
        description: `${width} × ${height} mm`,
        data: await createTrackingLabelPdf(resolvedFields, width, height),
        orientation: width >= height ? "landscape" : "portrait",
        paperSize: "document",
    };
}
