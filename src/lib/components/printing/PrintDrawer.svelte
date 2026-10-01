<script lang="ts">
    import { onDestroy, tick } from "svelte";
    import { Accordion, Dialog } from "bits-ui";
    import { fade, fly } from "svelte/transition";
    import { toast } from "svelte-sonner";
    import * as Icon from "lucide-svelte";
    import MyAccordion from "$lib/components/MyAccordion.svelte";
    import PdfPreview from "$lib/components/documents/PdfPreview.svelte";
    import { Button, Checkbox, NumberInput, Radio, Select, TextInput } from "$lib/components/istyler";
    import {
        countPages,
        formatPageRanges,
        getPrinterCapabilities,
        listInstalledPrinters,
        markPrintRequestUnknown,
        parsePageRanges,
        printErrorMessage,
        printFailureAction,
        PRINT_MAX_PAGE_COUNT,
        PRINT_MIN_PAGE_SIZE_INCHES,
        PRINT_PAPER_SIZES,
        printPreferences,
        printRequest,
        releasePrintRequest,
        resolveNativePrinterName,
        resolvePrintJobPrinter,
        printerSelectionAvailable,
        sendToPrinter,
        showPrintRequestPanel,
        SYSTEM_PRINTER_VALUE,
        type PrintDocumentMeta,
        type PrintMargins,
        type PrintPaperSize,
        type PrintRequest,
        type PrinterCapabilities,
        type PrinterInfo,
    } from "$lib/printing";
    import { loadTrackingLabelPrinter } from "$lib/trackingLabel";
    import { animationTime } from "$lib/uiPreferences";
    import PrintDocument from "./PrintDocument.svelte";
    import TextPrintPreview from "./TextPrintPreview.svelte";

    const MARGINS = {
        none: 0,
        narrow: 0.25,
        normal: 0.65,
        wide: 1,
    } as const;
    type MarginPreset = keyof typeof MARGINS;

    let job = $state<PrintRequest | null>(null);
    let drawerOpen = $state(false);
    let directAttempt = $state(false);
    let outcomeUnknown = $state(false);
    let outcomeUnknownMessage = $state("");
    let printing = $state(false);
    let printersLoading = $state(false);
    let printersReady = $state(false);
    let printers = $state<PrinterInfo[]>([]);
    let capabilities = $state<PrinterCapabilities | null>(null);
    let capabilitiesReady = $state(false);
    let renderReady = $state(false);
    let renderError = $state("");
    let textPages = $state<string[]>([]);
    let visiblePage = $state(1);
    let documentMeta = $state<PrintDocumentMeta>({ pageCount: 1, ...PRINT_PAPER_SIZES.a4 });
    let printerSelection = $state(SYSTEM_PRINTER_VALUE);
    let copies = $state<number | null>(1);
    let color = $state<"color" | "grayscale">("color");
    let orientation = $state<"portrait" | "landscape">("portrait");
    let paperSize = $state<PrintPaperSize>("document");
    let marginPreset = $state<MarginPreset>("none");
    let duplex = $state(false);
    let pageMode = $state<"all" | "range">("all");
    let pageRange = $state("");
    let advancedOpen = $state(false);
    let handledRequestId = 0;
    let capabilityRequest = 0;
    let capabilityTimer: number | null = null;
    const capabilityCache = new Map<string, PrinterCapabilities | null>();

    function supportsPaper(width: number, height: number): boolean | null {
        if (!capabilities || capabilities.paperSizes.length === 0) return null;
        return capabilities.paperSizes.some((candidate) => {
            const direct = Math.abs(candidate.width - width) <= 0.04
                && Math.abs(candidate.height - height) <= 0.04;
            const rotated = Math.abs(candidate.width - height) <= 0.04
                && Math.abs(candidate.height - width) <= 0.04;
            return direct || rotated;
        });
    }

    function applyCapabilities(result: PrinterCapabilities | null) {
        capabilities = result;
        let normalized = false;
        if (result?.supportsColor === false && color !== "grayscale") {
            color = "grayscale";
            normalized = true;
        }
        if (result?.supportsDuplex === false && duplex) {
            duplex = false;
            normalized = true;
        }
        return normalized;
    }

    function useCapabilityFallback() {
        applyCapabilities(null);
        capabilitiesReady = true;
    }

    function validDocumentMeta(meta: PrintDocumentMeta) {
        return Number.isSafeInteger(meta.pageCount)
            && meta.pageCount >= 1
            && meta.pageCount <= PRINT_MAX_PAGE_COUNT
            && Number.isFinite(meta.width)
            && Number.isFinite(meta.height)
            && meta.width >= PRINT_MIN_PAGE_SIZE_INCHES
            && meta.width <= 200
            && meta.height >= PRINT_MIN_PAGE_SIZE_INCHES
            && meta.height <= 200;
    }

    function updateDocumentMeta(meta: PrintDocumentMeta) {
        if (!validDocumentMeta(meta)) {
            renderError = "Les dimensions de ce document ne permettent pas une impression fiable.";
            renderReady = false;
            fallbackToPanel();
            return false;
        }
        if (meta.pageCount !== documentMeta.pageCount
            || meta.width !== documentMeta.width
            || meta.height !== documentMeta.height) {
            documentMeta = meta;
        }
        return true;
    }

    function updateVisiblePage(page: number) {
        if (Number.isSafeInteger(page) && page >= 1 && page <= documentMeta.pageCount) {
            visiblePage = page;
        }
    }

    const systemPrinter = $derived(printers.find((printer) => printer.isDefault));
    const printerOptions = $derived([
        {
            value: SYSTEM_PRINTER_VALUE,
            label: systemPrinter
                ? `Par défaut · ${systemPrinter.name}`
                : "Aucune imprimante système par défaut",
            disabled: !systemPrinter,
        },
        ...(printersReady
            && Boolean(printerSelection)
            && printerSelection !== SYSTEM_PRINTER_VALUE
            && !printers.some((printer) => printer.name === printerSelection)
            ? [{
                value: printerSelection,
                label: printerSelection,
                helpText: "Imprimante indisponible",
                disabled: true,
            }]
            : []),
        ...printers.map((printer) => ({
            value: printer.name,
            label: printer.name,
            helpText: printer.isDefault ? "Imprimante système par défaut" : undefined,
        })),
    ]);
    const selectedPrinter = $derived(
        printerSelection !== SYSTEM_PRINTER_VALUE
            ? printerSelection || "Imprimante non sélectionnée"
            : systemPrinter?.name || "Imprimante non sélectionnée",
    );
    const nativePrinterName = $derived(
        resolveNativePrinterName(printerSelection),
    );
    const capabilityPrinterName = $derived(
        printerSelection !== SYSTEM_PRINTER_VALUE ? printerSelection : "",
    );
    const selectedPrinterAvailable = $derived(
        printerSelectionAvailable(printerSelection, printers),
    );
    const paper = $derived.by(() => {
        const requested = paperSize === "document"
            ? { width: documentMeta.width, height: documentMeta.height }
            : PRINT_PAPER_SIZES[paperSize];
        const portrait = {
            width: Math.min(requested.width, requested.height),
            height: Math.max(requested.width, requested.height),
        };
        return {
            nativeWidth: portrait.width,
            nativeHeight: portrait.height,
            width: orientation === "landscape" ? portrait.height : portrait.width,
            height: orientation === "landscape" ? portrait.width : portrait.height,
        };
    });
    const paperSupported = $derived.by<boolean | null>(() => {
        return paperSize === "document" ? null : supportsPaper(paper.nativeWidth, paper.nativeHeight);
    });
    const paperOptions = $derived([
        { label: "Format du document", value: "document" },
        ...Object.entries(PRINT_PAPER_SIZES).map(([value, size]) => {
            const supported = supportsPaper(size.width, size.height) !== false;
            return {
                label: value === "letter" ? "Lettre" : value.toUpperCase(),
                value,
                disabled: !supported,
                helpText: supported ? undefined : "Non déclaré par le pilote",
            };
        }),
    ]);
    const selectedRanges = $derived(
        parsePageRanges(
            pageMode === "range" ? pageRange : "",
            documentMeta.pageCount,
            pageMode === "all",
        ),
    );
    const pageRangeValid = $derived(selectedRanges !== null);
    const hardwareMargins = $derived.by<PrintMargins>(() => {
        const area = capabilities?.printableArea;
        if (!area) return { top: 0, right: 0, bottom: 0, left: 0 };
        return {
            top: Math.max(0, area.y),
            right: Math.max(0, paper.width - area.x - area.width),
            bottom: Math.max(0, paper.height - area.y - area.height),
            left: Math.max(0, area.x),
        };
    });
    const margins = $derived.by<PrintMargins>(() => {
        const selected = MARGINS[marginPreset];
        return {
            top: Math.max(selected, hardwareMargins.top),
            right: Math.max(selected, hardwareMargins.right),
            bottom: Math.max(selected, hardwareMargins.bottom),
            left: Math.max(selected, hardwareMargins.left),
        };
    });
    const marginsValid = $derived(
        Object.values(margins).every((value) => Number.isFinite(value) && value >= 0)
        && margins.left + margins.right < paper.width
        && margins.top + margins.bottom < paper.height,
    );
    const canPrint = $derived(
        Boolean(job)
        && renderReady
        && printersReady
        && capabilitiesReady
        && printers.length > 0
        && selectedPrinterAvailable
        && !renderError
        && !printing
        && copies !== null
        && Number.isInteger(copies)
        && copies >= 1
        && copies <= 99
        && marginsValid
        && paperSupported !== false
        && pageRangeValid,
    );
    const selectedPageCount = $derived(selectedRanges ? countPages(selectedRanges) : documentMeta.pageCount);
    const summary = $derived(
        `${selectedPageCount} page${selectedPageCount > 1 ? "s" : ""} · ${copies ?? 0} copie${copies === 1 ? "" : "s"}`,
    );

    async function showDrawer() {
        const requestId = job?.id;
        if (!requestId || drawerOpen) return;
        await tick();
        if (job?.id === requestId) drawerOpen = true;
    }

    function fallbackToPanel() {
        const requestId = job?.id;
        if (!requestId) return;
        directAttempt = false;
        showPrintRequestPanel(requestId);
        void showDrawer();
    }

    async function refreshPrinters(requestId: number) {
        printersLoading = true;
        printersReady = false;
        try {
            const installed = await listInstalledPrinters();
            if (job?.id !== requestId) return;
            printers = installed;
            if (printerSelection !== SYSTEM_PRINTER_VALUE
                && !installed.some((printer) => printer.name === printerSelection)) {
                if (directAttempt) {
                    fallbackToPanel();
                    toast.error("L’imprimante configurée n’est plus disponible.");
                }
            } else if (printerSelection === SYSTEM_PRINTER_VALUE
                && !installed.some((printer) => printer.isDefault)
                && directAttempt) {
                fallbackToPanel();
            }
        } catch (error) {
            console.error("Failed to list printers", error);
            if (job?.id === requestId) printers = [];
        } finally {
            if (job?.id === requestId) {
                if (printers.length === 0 && directAttempt) {
                    fallbackToPanel();
                }
                printersLoading = false;
                printersReady = true;
            }
        }
    }

    function prepareRequest(request: PrintRequest) {
        const preferences = $printPreferences;
        job = request;
        renderReady = false;
        renderError = "";
        textPages = [];
        visiblePage = 1;
        documentMeta = { pageCount: 1, ...PRINT_PAPER_SIZES.a4 };
        printerSelection = resolvePrintJobPrinter(
            request,
            preferences.printerName,
            loadTrackingLabelPrinter(),
        );
        copies = preferences.defaults.copies;
        color = preferences.defaults.color;
        orientation = request.orientation ?? preferences.defaults.orientation;
        paperSize = request.paperSize ?? preferences.defaults.paperSize;
        duplex = preferences.defaults.duplex;
        marginPreset = request.kind === "text" ? "normal" : "none";
        pageMode = "all";
        pageRange = "";
        advancedOpen = false;
        outcomeUnknown = request.presentation === "unknown";
        outcomeUnknownMessage = outcomeUnknown
            ? "Le résultat de la précédente tentative n’a pas été confirmé."
            : "";
        directAttempt = request.presentation === "direct";
        capabilities = null;
        capabilitiesReady = false;
        capabilityCache.clear();
        if (directAttempt) {
            drawerOpen = false;
        } else {
            void showDrawer();
        }
        void refreshPrinters(request.id);
    }

    function releaseCurrentRequest() {
        const requestId = job?.id;
        job = null;
        drawerOpen = false;
        directAttempt = false;
        outcomeUnknown = false;
        outcomeUnknownMessage = "";
        renderReady = false;
        if (requestId) releasePrintRequest(requestId);
    }

    function closeDrawer() {
        if (!drawerOpen) {
            releaseCurrentRequest();
            return;
        }
        drawerOpen = false;
    }

    function markRenderPending() {
        renderReady = false;
    }

    function retryPrint() {
        const requestId = job?.id;
        if (!requestId || !canPrint) return;
        if (outcomeUnknown) {
            outcomeUnknown = false;
            outcomeUnknownMessage = "";
            showPrintRequestPanel(requestId);
        }
        void print();
    }

    async function print() {
        if (!job || !canPrint || copies === null) return;
        printing = true;
        const requestId = job.id;
        const attemptedDirectPrint = directAttempt;

        try {
            document.documentElement.classList.add("psoft-printing");
            await tick();
            await document.fonts.ready;
            await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
            await sendToPrinter({
                printerName: nativePrinterName,
                copies,
                color,
                orientation,
                duplex,
                pageWidth: paper.nativeWidth,
                pageHeight: paper.nativeHeight,
                margins,
                pageRanges: pageMode === "range" && selectedRanges ? formatPageRanges(selectedRanges) : "",
            });
            if (job?.id !== requestId) return;
            toast.success("Document envoyé à l’imprimante.");
            closeDrawer();
        } catch (error) {
            if (job?.id !== requestId) return;
            console.error("Failed to print document", error);
            const action = printFailureAction(attemptedDirectPrint, error);
            const message = printErrorMessage(error);
            if (action === "unknown") {
                directAttempt = false;
                outcomeUnknown = true;
                outcomeUnknownMessage = message;
                markPrintRequestUnknown(requestId);
                toast.warning(`${message} Vérifiez la file de l’imprimante avant toute nouvelle tentative.`);
                void showDrawer();
            } else {
                toast.error(message);
            }
            if (action === "panel") {
                fallbackToPanel();
            }
            void refreshPrinters(requestId);
        } finally {
            document.documentElement.classList.remove("psoft-printing");
            printing = false;
        }
    }

    $effect(() => {
        const request = $printRequest;
        if (!request || request.id === handledRequestId) return;
        handledRequestId = request.id;
        prepareRequest(request);
    });

    $effect(() => {
        const requestId = job?.id;
        const printerName = capabilityPrinterName;
        const pageWidth = paper.nativeWidth;
        const pageHeight = paper.nativeHeight;
        const currentOrientation = orientation;
        const currentColor = color;
        const currentDuplex = duplex;
        if (capabilityTimer !== null) window.clearTimeout(capabilityTimer);
        const request = ++capabilityRequest;
        capabilities = null;
        capabilitiesReady = false;
        if (!requestId || !printersReady || !printerName) {
            if (printersReady) capabilitiesReady = true;
            return;
        }

        const cacheKey = `${printerName}\0${pageWidth}\0${pageHeight}\0${currentOrientation}\0${currentColor}\0${currentDuplex}`;
        if (capabilityCache.has(cacheKey)) {
            capabilitiesReady = !applyCapabilities(capabilityCache.get(cacheKey) ?? null);
            return;
        }
        capabilityTimer = window.setTimeout(() => {
            capabilityTimer = null;
            let settled = false;
            const timeout = window.setTimeout(() => {
                if (settled || request !== capabilityRequest || job?.id !== requestId) return;
                settled = true;
                useCapabilityFallback();
            }, 8_000);
            void getPrinterCapabilities(
                printerName,
                pageWidth,
                pageHeight,
                currentOrientation,
                currentColor,
                currentDuplex,
            )
                .then((result) => {
                    if (settled || request !== capabilityRequest || job?.id !== requestId) return;
                    settled = true;
                    window.clearTimeout(timeout);
                    capabilityCache.set(cacheKey, result);
                    const normalized = applyCapabilities(result);
                    capabilitiesReady = !normalized;
                })
                .catch((capabilityError) => {
                    if (settled || request !== capabilityRequest || job?.id !== requestId) return;
                    settled = true;
                    window.clearTimeout(timeout);
                    console.warn("Printer capabilities unavailable", capabilityError);
                    useCapabilityFallback();
                });
        }, 120);
    });

    $effect(() => {
        if (!job || !directAttempt || !capabilitiesReady || paperSupported !== false) return;
        toast.error("Le format configuré n’est pas pris en charge par cette imprimante.");
        fallbackToPanel();
    });

    $effect(() => {
        if (job && directAttempt && canPrint) {
            void print();
        }
    });

    onDestroy(() => {
        capabilityRequest += 1;
        if (capabilityTimer !== null) window.clearTimeout(capabilityTimer);
        const requestId = job?.id;
        if (requestId) releasePrintRequest(requestId);
    });
</script>

{#if job}
    {#key job.id}
        <PrintDocument
            {job}
            paperWidth={paper.width}
            paperHeight={paper.height}
            {margins}
            onMetadata={updateDocumentMeta}
            onPending={markRenderPending}
            onTextPages={(pages) => (textPages = pages)}
            onReady={(meta) => {
                if (updateDocumentMeta(meta)) renderReady = true;
            }}
            onError={(message) => {
                renderError = message;
                renderReady = false;
                fallbackToPanel();
            }}
        />
    {/key}
{/if}

<Dialog.Root
    open={drawerOpen}
    onOpenChange={(open) => {
        if (open || (!printing && !outcomeUnknown)) drawerOpen = open;
    }}
>
    {#if job}
    <Dialog.Portal>
        <Dialog.Overlay forceMount>
            {#snippet child({ props, open })}
                {#if open}
                    <div
                        {...props}
                        class="fixed inset-0 z-(--z-overlay) bg-black/40"
                        transition:fade={{ duration: animationTime(400) }}
                    ></div>
                {/if}
            {/snippet}
        </Dialog.Overlay>
        <Dialog.Content
            forceMount
            preventScroll={false}
            onInteractOutside={(event) => {
                if (printing) event.preventDefault();
            }}
            onEscapeKeydown={(event) => {
                if (printing) event.preventDefault();
            }}
        >
            {#snippet child({ props, open })}
            {#if open}
            <div
                {...props}
                id="psoft-print-drawer"
                class="fixed inset-x-0 top-0 z-(--z-overlay) mx-auto h-[min(650px,calc(100dvh-16px))]! w-[min(1040px,calc(100vw-24px))] overflow-visible rounded-b-xl border border-t-0 border-(--light-bg3) bg-(--light-bg1) text-(--dark-bg1) shadow-(--shadow-popover) outline-none! select-text!"
                transition:fly={{ y: "-100%", opacity: 1, duration: animationTime(400) }}
                onoutroend={() => {
                    if (!drawerOpen) releaseCurrentRequest();
                }}
            >
            {#if job}
                <div class="grid h-full min-h-0 grid-rows-[60px_minmax(0,1fr)_60px] overflow-hidden rounded-b-xl font-(family-name:--font)">
                    <header class="flex items-center gap-4 border-b border-(--light-bg3) px-5">
                        <div class="min-w-0">
                            <Dialog.Title class="truncate text-base font-bold">Imprimer</Dialog.Title>
                            <Dialog.Description class="truncate text-xs text-(--grey)">
                                {job.description || job.title}
                            </Dialog.Description>
                        </div>
                    </header>

                    <div class="grid min-h-0 grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)]">
                        <section
                            class="min-h-0 overflow-hidden border-r border-(--light-bg3) bg-(--light-bg2)"
                            style:filter={color === "grayscale" ? "grayscale(1)" : undefined}
                            aria-label="Aperçu avant impression"
                        >
                            {#if renderError}
                                <div class="flex h-full items-center justify-center px-6 text-center" role="alert">
                                    <p class="max-w-sm text-sm font-medium text-(--red)">{renderError}</p>
                                </div>
                            {:else if pageMode === "range" && !selectedRanges}
                                <div class="flex h-full items-center justify-center px-6 text-center">
                                    <p class="max-w-sm text-sm font-medium text-(--grey)">
                                        Saisissez une plage valide pour actualiser l’aperçu.
                                    </p>
                                </div>
                            {:else if job.kind === "pdf" && job.data}
                                <PdfPreview
                                    data={job.data}
                                    label={job.title}
                                    onVisiblePage={updateVisiblePage}
                                    layout={{
                                        paperWidth: paper.width,
                                        paperHeight: paper.height,
                                        margins,
                                        printableArea: capabilities?.printableArea ?? null,
                                        pageRanges: selectedRanges ?? [],
                                    }}
                                />
                            {:else if textPages.length > 0}
                                <TextPrintPreview
                                    pages={textPages}
                                    title={job.title}
                                    paperWidth={paper.width}
                                    paperHeight={paper.height}
                                    {margins}
                                    printableArea={capabilities?.printableArea ?? null}
                                    pageRanges={selectedRanges ?? []}
                                    onVisiblePage={updateVisiblePage}
                                />
                            {:else}
                                <div class="flex h-full items-center justify-center text-(--grey)" aria-live="polite">
                                    <Icon.LoaderCircle size={20} class="ui-loader-spin" />
                                    <span class="sr-only">Pagination de l’aperçu…</span>
                                </div>
                            {/if}
                        </section>

                        <form id="psoft-print-form" class="flex min-h-0 flex-col overflow-hidden" onsubmit={(event) => {
                            event.preventDefault();
                            if (!outcomeUnknown) void print();
                        }}>
                            <div class="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-5">
                                <section>
                                    <div class="mb-2 flex items-center justify-between gap-3">
                                        <div>
                                            <h3 class="text-sm font-semibold">Imprimante</h3>
                                            <p class="text-xs text-(--grey)">Choix pour ce tirage</p>
                                        </div>
                                        <span class="flex items-center gap-1.5 text-xs text-(--grey)">
                                            {#if printersLoading || (printersReady && !capabilitiesReady)}
                                                <Icon.LoaderCircle size={13} class="ui-loader-spin" /> Recherche
                                            {:else if printers.length > 0}
                                                <span class="size-1.5 rounded-full bg-(--green)"></span> Disponible
                                            {:else}
                                                <span class="size-1.5 rounded-full bg-(--red)"></span> Aucune imprimante
                                            {/if}
                                        </span>
                                    </div>
                                    <Select
                                        name="print-printer"
                                        ariaLabel="Imprimante"
                                        options={printerOptions}
                                        bind:value={printerSelection}
                                        allowDeselect={false}
                                        portalTarget="#psoft-print-drawer"
                                        disabled={printersLoading || printing}
                                    />
                                </section>

                                <section class="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-t border-(--light-bg3) pt-4">
                                    <NumberInput
                                        name="print-copies"
                                        label="Copies"
                                        min={1}
                                        max={99}
                                        bind:value={copies}
                                        disabled={printing}
                                        display="lateral"
                                    />
                                    <div>
                                        <Radio
                                            name="print-pages"
                                            label="Pages"
                                            box
                                            bind:value={pageMode}
                                            disabled={printing}
                                            options={[
                                                { label: "Toutes", value: "all", hideCheckbox: true },
                                                { label: "Plage", value: "range", hideCheckbox: true },
                                            ]}
                                            parentClass="min-h-8 py-1.5!"
                                            groupClass="grid grid-cols-2 gap-2"
                                        />
                                        {#if pageMode === "range"}
                                            <div class="mt-2">
                                                <TextInput
                                                    name="print-page-range"
                                                    aria-label="Plage de pages"
                                                    placeholder={`Ex. 1-${documentMeta.pageCount}`}
                                                    bind:value={pageRange}
                                                    disabled={printing}
                                                />
                                                {#if !pageRangeValid}
                                                    <p class="mt-1 text-xs text-(--red)">Indiquez une plage comprise entre 1 et {documentMeta.pageCount}.</p>
                                                {/if}
                                            </div>
                                        {/if}
                                    </div>
                                </section>

                                <section class="border-t border-(--light-bg3) pt-4">
                                    <Radio
                                        name="print-color"
                                        label="Rendu"
                                        box
                                        bind:value={color}
                                        disabled={printing}
                                        options={[
                                            {
                                                icon: "Palette",
                                                label: "Couleur",
                                                value: "color",
                                                helpText: capabilities?.supportsColor === false ? "Non prise en charge" : "Rendu original",
                                                hideCheckbox: true,
                                                disabled: capabilities?.supportsColor === false,
                                            },
                                            { icon: "CircleOff", label: "Noir et blanc", value: "grayscale", helpText: "Économie d’encre", hideCheckbox: true },
                                        ]}
                                        parentClass="min-h-15"
                                        groupClass="grid grid-cols-2 gap-2"
                                    />
                                </section>

                                <Accordion.Root
                                    type="multiple"
                                    value={advancedOpen ? ["advanced"] : []}
                                    onValueChange={(items) => (advancedOpen = items.includes("advanced"))}
                                    class="overflow-hidden rounded-lg border border-(--light-bg3)"
                                >
                                    <Accordion.Item value="advanced">
                                        <Accordion.Header>
                                            <Accordion.Trigger class="flex h-10 w-full cursor-pointer items-center justify-between px-3 text-left text-xs font-semibold hover:bg-(--light-bg2)">
                                                Options avancées
                                                <Icon.ChevronDown size={15} class={`text-(--grey) transition-transform duration-(--animation-duration) ${advancedOpen ? "rotate-180" : ""}`} />
                                            </Accordion.Trigger>
                                        </Accordion.Header>
                                        <MyAccordion expanded={advancedOpen}>
                                            <div class="flex flex-col gap-4 p-3">
                                                <div class="flex items-start gap-4">
                                                    <div class="min-w-0 flex-1">
                                                        <Select
                                                            name="print-paper-size"
                                                            label="Format"
                                                            bind:value={paperSize}
                                                            allowDeselect={false}
                                                            portalTarget="#psoft-print-drawer"
                                                            disabled={printing}
                                                            options={paperOptions}
                                                        />
                                                    </div>
                                                    <div class="min-w-0 flex-1">
                                                        <Radio
                                                            name="print-orientation"
                                                            label="Orientation"
                                                            bind:value={orientation}
                                                            disabled={printing}
                                                            options={[
                                                                { label: "Portrait", value: "portrait", icon: "RectangleVertical", hideCheckbox: true },
                                                                { label: "Paysage", value: "landscape", icon: "RectangleHorizontal", hideCheckbox: true },
                                                            ]}
                                                            box
                                                            groupClass="flex gap-2"
                                                            parentClass="min-h-10! min-w-0 flex-1 px-2.5! py-2!"
                                                        />
                                                    </div>
                                                </div>
                                                <Radio
                                                    name="print-margin"
                                                    label="Marges"
                                                    bind:value={marginPreset}
                                                    disabled={printing}
                                                    options={[
                                                        { label: "Minimales", value: "none", icon: "Minimize2", hideCheckbox: true },
                                                        { label: "Étroites", value: "narrow", icon: "Shrink", hideCheckbox: true },
                                                        { label: "Normales", value: "normal", icon: "Scan", hideCheckbox: true },
                                                        { label: "Larges", value: "wide", icon: "Maximize2", hideCheckbox: true },
                                                    ]}
                                                    box
                                                    groupClass="flex flex-wrap gap-2"
                                                    parentClass="min-h-10! min-w-0 basis-[calc(50%-0.25rem)] px-2.5! py-2!"
                                                />
                                                <div class="flex flex-col gap-1">
                                                    <span class="input-label">Faces</span>
                                                    <Checkbox
                                                        name="print-duplex"
                                                        bind:value={duplex}
                                                        disabled={printing || capabilities?.supportsDuplex === false}
                                                        switchMode
                                                        side="left"
                                                        class="h-10 w-full justify-between rounded-lg border border-(--light-bg3) px-3"
                                                    >
                                                        {#snippet content()}
                                                            <span class="flex items-center gap-2 font-medium">
                                                                <Icon.Copy size={16} class="text-(--grey)" />
                                                                Recto verso
                                                            </span>
                                                        {/snippet}
                                                    </Checkbox>
                                                </div>
                                                {#if capabilitiesReady && capabilityPrinterName && !capabilities?.printableArea}
                                                    <p class="text-xs text-(--grey)">
                                                        {capabilities && !capabilities.pageSizeSupported
                                                            ? "Format non déclaré par le pilote. Zone imprimable indisponible."
                                                            : "Zone imprimable non communiquée par le pilote."}
                                                    </p>
                                                {/if}
                                            </div>
                                        </MyAccordion>
                                    </Accordion.Item>
                                </Accordion.Root>
                            </div>
                        </form>
                    </div>

                    <footer class="flex items-center justify-between gap-4 border-t border-(--light-bg3) px-5">
                        <div class="min-w-0">
                            {#if outcomeUnknown}
                                <div class="flex items-center gap-1.5 text-xs font-semibold text-amber-700" role="status">
                                    <Icon.TriangleAlert size={14} class="shrink-0" />
                                    <span class="truncate">{outcomeUnknownMessage}</span>
                                </div>
                                <div class="truncate text-xs text-(--grey)">Vérifiez la file de l’imprimante avant de décider.</div>
                            {:else}
                                <div class="flex items-center gap-2 text-xs font-semibold">
                                    <span class="truncate">{summary}</span>
                                    {#if renderReady && pageRangeValid && documentMeta.pageCount > 1}
                                        <span class="shrink-0 border-l border-(--light-bg3) pl-2" aria-live="polite">
                                            Page {visiblePage}/{documentMeta.pageCount}
                                        </span>
                                    {/if}
                                </div>
                                <div class="truncate text-xs text-(--grey)">{selectedPrinter} · {color === "color" ? "Couleur" : "Noir et blanc"}</div>
                            {/if}
                        </div>
                        <div class="flex shrink-0 items-center gap-2">
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                label={outcomeUnknown ? "Abandonner" : "Annuler"}
                                disabled={printing}
                                class="w-fit"
                                confirm={outcomeUnknown}
                                confirmTitle="Abandonner ce travail d’impression ?"
                                confirmDescription="Son résultat n’a pas été confirmé. Vérifiez d’abord la file de l’imprimante. L’abandon retirera définitivement ce travail de la file PSoft."
                                confirmConfirmLabel="Abandonner"
                                confirmConfirmVariant="error"
                                onclick={closeDrawer}
                            />
                            <Button
                                type="button"
                                size="sm"
                                icon={printing || (!renderReady && !renderError) ? "LoaderCircle" : renderError || outcomeUnknown ? "TriangleAlert" : "Printer"}
                                iconAnimation={printing || (!renderReady && !renderError) ? "spin" : undefined}
                                label={printing ? "Impression…" : renderError ? "Indisponible" : outcomeUnknown ? "Réessayer" : renderReady ? "Imprimer" : "Préparation…"}
                                disabled={!canPrint}
                                class="w-fit"
                                confirm={outcomeUnknown}
                                confirmTitle="Relancer ce travail d’impression ?"
                                confirmDescription="La tentative précédente peut déjà avoir été acceptée. Vérifiez d’abord la file de l’imprimante : confirmer peut produire un doublon."
                                confirmConfirmLabel="Réessayer"
                                confirmConfirmVariant="warning"
                                onclick={retryPrint}
                            />
                        </div>
                    </footer>
                </div>
            {/if}
            </div>
            {/if}
            {/snippet}
        </Dialog.Content>
    </Dialog.Portal>
    {/if}
</Dialog.Root>
