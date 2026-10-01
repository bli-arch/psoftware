import { describe, expect, test } from "bun:test";
import { get } from "svelte/store";
import {
    createPrintQueue,
    initialPrintPresentation,
    printErrorMessage,
    printFailureAction,
    printerSelectionAvailable,
    resolveNativePrinterName,
    resolvePrintJobPrinter,
    SYSTEM_PRINTER_VALUE,
    type PrintJob,
} from "./printing";

function job(title: string, overrides: Partial<PrintJob> = {}): PrintJob {
    return {
        type: "document",
        mode: "manual",
        kind: "pdf",
        title,
        data: new ArrayBuffer(1),
        ...overrides,
    };
}

describe("print job policy", () => {
    const cases = [
        ["document", "manual", false, "panel"],
        ["document", "manual", true, "direct"],
        ["document", "automatic", false, "panel"],
        ["document", "automatic", true, "direct"],
        ["tracking-label", "manual", false, "panel"],
        ["tracking-label", "manual", true, "panel"],
        ["tracking-label", "automatic", false, "direct"],
        ["tracking-label", "automatic", true, "direct"],
    ] as const;

    for (const [type, mode, direct, expected] of cases) {
        test(`${type}/${mode} with document direct=${direct} uses ${expected}`, () => {
            expect(initialPrintPresentation({ type, mode }, direct)).toBe(expected);
        });
    }

    test("tracking labels never fall back to the document printer", () => {
        expect(resolvePrintJobPrinter(job("label", { type: "tracking-label" }), "Office", "Labels")).toBe("Labels");
        expect(resolvePrintJobPrinter(job("label", { type: "tracking-label" }), "Office", "")).toBe("");
        expect(resolvePrintJobPrinter(job("document"), "Office", "Labels")).toBe("Office");
    });

    test("keeps an unavailable label printer and resolves the system target only for native printing", () => {
        const printers = [{ name: "Office", isDefault: true }];
        const selection = resolvePrintJobPrinter(job("label", { type: "tracking-label" }), "Office", "Labels");
        expect(selection).toBe("Labels");
        expect(printerSelectionAvailable(selection, printers)).toBe(false);
        expect(resolveNativePrinterName(selection)).toBe("Labels");
        expect(resolveNativePrinterName(SYSTEM_PRINTER_VALUE)).toBe("");
    });

    test("keeps every ambiguous outcome blocked regardless of the print mode", () => {
        const unknown = "PRINT_OUTCOME_UNKNOWN:L’imprimante n’a pas confirmé le travail dans le délai imparti.";
        expect(printFailureAction(false, new Error("driver failed"))).toBe("retry");
        expect(printFailureAction(false, unknown)).toBe("unknown");
        expect(printFailureAction(true, "driver failed")).toBe("panel");
        expect(printFailureAction(true, unknown)).toBe("unknown");
        expect(printErrorMessage(unknown)).toBe("L’imprimante n’a pas confirmé le travail dans le délai imparti.");
    });
});

describe("print queue", () => {
    test("keeps every valid job in FIFO order with unique ids", () => {
        const queue = createPrintQueue(() => true);
        for (const title of ["first", "second", "third"]) expect(queue.enqueue(job(title))).toBe(true);

        const seen: Array<[number, string]> = [];
        while (get(queue.request)) {
            const current = get(queue.request)!;
            seen.push([current.id, current.title]);
            expect(queue.release(current.id)).toBe(true);
        }

        expect(seen.map(([, title]) => title)).toEqual(["first", "second", "third"]);
        expect(new Set(seen.map(([id]) => id)).size).toBe(3);
    });

    test("keeps a direct fallback as the same blocking job without duplication", () => {
        const queue = createPrintQueue(() => true);
        queue.enqueue(job("first"));
        queue.enqueue(job("second"));
        const first = get(queue.request)!;

        expect(first.presentation).toBe("direct");
        expect(queue.showPanel(first.id)).toBe(true);
        expect(queue.showPanel(first.id)).toBe(false);
        expect(get(queue.request)).toMatchObject({ id: first.id, title: "first", presentation: "panel" });

        expect(queue.release(first.id)).toBe(true);
        expect(get(queue.request)?.title).toBe("second");
    });

    test("blocks the FIFO on an unknown outcome until retry or abandonment is confirmed", () => {
        const queue = createPrintQueue(() => true);
        queue.enqueue(job("first"));
        queue.enqueue(job("second"));
        const first = get(queue.request)!;

        expect(queue.markUnknown(first.id)).toBe(true);
        expect(get(queue.request)).toMatchObject({ id: first.id, presentation: "unknown" });
        expect(queue.markUnknown(first.id)).toBe(false);
        expect(get(queue.request)?.title).toBe("first");

        expect(queue.showPanel(first.id)).toBe(true);
        expect(get(queue.request)).toMatchObject({ id: first.id, presentation: "panel" });
        expect(queue.markUnknown(first.id)).toBe(true);
        expect(queue.release(first.id)).toBe(true);
        expect(get(queue.request)?.title).toBe("second");
    });

    test("ignores stale transitions and advances after cancellation", () => {
        const queue = createPrintQueue();
        queue.enqueue(job("first"));
        queue.enqueue(job("second"));
        const firstId = get(queue.request)!.id;

        expect(queue.release(firstId + 1)).toBe(false);
        expect(get(queue.request)?.title).toBe("first");
        expect(queue.release(firstId)).toBe(true);
        const second = get(queue.request)!;
        expect(second.title).toBe("second");
        expect(queue.showPanel(firstId)).toBe(false);
        expect(queue.release(second.id)).toBe(true);
        expect(get(queue.request)).toBeNull();
    });

    test("rejects invalid jobs without affecting the active queue", () => {
        const queue = createPrintQueue();
        queue.enqueue(job("valid"));
        const current = get(queue.request);
        expect(queue.enqueue(job("invalid", { data: undefined }))).toBe(false);
        expect(get(queue.request)).toEqual(current);
        expect(queue.release(current!.id)).toBe(true);
        expect(get(queue.request)).toBeNull();
    });

    test("stores only print data and never caller-owned DOM references", () => {
        const queue = createPrintQueue();
        const portalTarget = { nodeType: 1 };
        queue.enqueue({ ...job("safe"), portalTarget } as PrintJob);

        expect(get(queue.request)).not.toHaveProperty("portalTarget");
    });
});
