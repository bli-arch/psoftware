<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
    import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
    import { Button } from "$lib/components/istyler";
    import { observeVisiblePage } from "$lib/components/printing/previewVisibility";
    import { PRINT_MAX_PAGE_COUNT, type PrintMargins, type PrintPageRange, type PrintRect } from "$lib/printing";
    import * as Icon from "lucide-svelte";

    type PreviewLayout = {
        paperWidth: number;
        paperHeight: number;
        margins: PrintMargins;
        printableArea: PrintRect | null;
        pageRanges: PrintPageRange[];
    };

    type RenderConfig = {
        availableWidth: number;
        availableHeight: number;
        fit: "width" | "page";
        layout: PreviewLayout | null;
    };

    let { data, label = "Document PDF", layout = null, fit = "width", onVisiblePage } = $props<{
        data: ArrayBuffer;
        label?: string;
        layout?: PreviewLayout | null;
        fit?: "width" | "page";
        onVisiblePage?: (page: number) => void;
    }>();

    let viewportElement: HTMLDivElement;
    let pagesElement: HTMLDivElement;
    let loading = $state(true);
    let error = $state<string | null>(null);
    let loadingTask: PDFDocumentLoadingTask | null = null;
    let pdfDocument = $state<PDFDocumentProxy | null>(null);
    let renderTasks = new Set<RenderTask>();
    const renderingRequests = new Map<string, number>();
    const canvasCache = new Map<string, HTMLCanvasElement>();
    const visibleCacheKeys = new Set<string>();
    let cachedPixels = 0;
    let pageObserver: IntersectionObserver | null = null;
    let stopVisiblePageObserver: (() => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resizeTimer: number | null = null;
    let documentRequest = 0;
    let renderRequest = 0;
    let viewportWidth = $state(0);
    let viewportHeight = $state(0);
    let zoom = $state(1);

    const renderKey = $derived.by(() => {
        const printableArea = layout?.printableArea;
        const margins = layout?.margins;
        return [
            viewportWidth,
            fit === "page" ? viewportHeight : 0,
            fit,
            layout?.paperWidth,
            layout?.paperHeight,
            margins?.top,
            margins?.right,
            margins?.bottom,
            margins?.left,
            printableArea?.x,
            printableArea?.y,
            printableArea?.width,
            printableArea?.height,
            layout?.pageRanges.map(({ start, end }) => `${start}-${end}`).join(","),
        ].join(":");
    });

    const clampZoom = (value: number) => Math.min(2, Math.max(0.5, Math.round(value * 10) / 10));

    function disposeCanvasCache() {
        for (const canvas of canvasCache.values()) {
            canvas.width = 1;
            canvas.height = 1;
        }
        canvasCache.clear();
        cachedPixels = 0;
    }

    function cacheCanvas(key: string, canvas: HTMLCanvasElement) {
        const pixels = canvas.width * canvas.height;
        if (pixels > 24_000_000) return;
        const previous = canvasCache.get(key);
        if (previous) cachedPixels -= previous.width * previous.height;
        canvasCache.delete(key);
        canvasCache.set(key, canvas);
        cachedPixels += pixels;

        while (canvasCache.size > 32 || cachedPixels > 24_000_000) {
            let oldest = canvasCache.keys().next().value;
            for (const key of canvasCache.keys()) {
                if (!visibleCacheKeys.has(key)) {
                    oldest = key;
                    break;
                }
            }
            if (oldest === undefined) break;
            const evicted = canvasCache.get(oldest);
            canvasCache.delete(oldest);
            if (!evicted) continue;
            cachedPixels -= evicted.width * evicted.height;
            if (evicted !== canvas && !visibleCacheKeys.has(oldest)) {
                evicted.width = 1;
                evicted.height = 1;
            }
        }
    }

    function cancelRendering() {
        renderRequest += 1;
        pageObserver?.disconnect();
        pageObserver = null;
        stopVisiblePageObserver?.();
        stopVisiblePageObserver = null;
        visibleCacheKeys.clear();
        for (const task of renderTasks) task.cancel();
        renderTasks.clear();
    }

    async function loadPDF(source: ArrayBuffer) {
        const request = ++documentRequest;
        cancelRendering();
        disposeCanvasCache();
        pagesElement?.replaceChildren();
        pdfDocument = null;
        loading = true;
        error = null;

        const previousTask = loadingTask;
        loadingTask = null;
        if (previousTask) await previousTask.destroy().catch(() => undefined);
        if (request !== documentRequest) return;

        try {
            const pdfjs = await import("pdfjs-dist");
            pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
            if (request !== documentRequest) return;

            const task = pdfjs.getDocument({ data: new Uint8Array(source.slice(0)) });
            loadingTask = task;
            const pdf = await task.promise;
            if (request !== documentRequest) {
                await task.destroy().catch(() => undefined);
                return;
            }
            if (pdf.numPages < 1 || pdf.numPages > PRINT_MAX_PAGE_COUNT) {
                throw new Error("Invalid PDF page count");
            }
            pdfDocument = pdf;
        } catch (loadError) {
            if (request !== documentRequest) return;
            const failedTask = loadingTask;
            loadingTask = null;
            if (failedTask) await failedTask.destroy().catch(() => undefined);
            console.error("Failed to load PDF preview", loadError);
            error = "Impossible d’afficher l’aperçu de ce reçu.";
            loading = false;
        }
    }

    function selectedPages(pageCount: number, ranges: PrintPageRange[]) {
        const pages: number[] = [];
        for (const { start, end } of ranges) {
            for (let page = Math.max(1, start); page <= Math.min(pageCount, end); page += 1) {
                pages.push(page);
            }
        }
        return pages;
    }

    function percentage(value: number, total: number) {
        return `${Math.max(0, Math.min(100, value / total * 100))}%`;
    }

    function createPaper(pageNumber: number, config: RenderConfig) {
        const canvas = document.createElement("canvas");
        canvas.setAttribute("role", "img");
        canvas.setAttribute("aria-label", `${label}, page ${pageNumber}`);

        if (!config.layout) {
            return {
                target: canvas,
                canvas,
                width: Math.min(config.availableWidth, 880),
                height: config.fit === "page" ? config.availableHeight : 0,
            };
        }

        const { paperWidth, paperHeight, margins, printableArea } = config.layout;
        const paper = document.createElement("article");
        paper.className = "preview-paper";
        paper.setAttribute("aria-label", `Feuille ${pageNumber}`);
        const paperWidthPixels = Math.min(config.availableWidth, paperWidth < 4 ? 380 : 880);
        const paperHeightPixels = paperWidthPixels * paperHeight / paperWidth;
        paper.style.width = `${paperWidthPixels}px`;
        paper.style.height = `${paperHeightPixels}px`;

        const content = document.createElement("div");
        content.className = "preview-content";
        content.style.left = percentage(margins.left, paperWidth);
        content.style.top = percentage(margins.top, paperHeight);
        content.style.right = percentage(margins.right, paperWidth);
        content.style.bottom = percentage(margins.bottom, paperHeight);
        content.append(canvas);
        paper.append(content);

        if (printableArea
            && printableArea.width > 0
            && printableArea.height > 0
            && printableArea.x >= 0
            && printableArea.y >= 0) {
            const printable = document.createElement("div");
            printable.className = "preview-printable-area";
            printable.title = "Zone imprimable déclarée par le pilote";
            printable.style.left = percentage(printableArea.x, paperWidth);
            printable.style.top = percentage(printableArea.y, paperHeight);
            printable.style.width = percentage(printableArea.width, paperWidth);
            printable.style.height = percentage(printableArea.height, paperHeight);
            paper.append(printable);
        }

        return {
            target: paper,
            canvas,
            width: Math.max(1, paperWidthPixels * (paperWidth - margins.left - margins.right) / paperWidth),
            height: Math.max(1, paperHeightPixels * (paperHeight - margins.top - margins.bottom) / paperHeight),
        };
    }

    async function renderPage(
        pdf: PDFDocumentProxy,
        pageNumber: number,
        canvas: HTMLCanvasElement,
        width: number,
        height: number,
        cacheKey: string,
        request: number,
    ) {
        try {
            const page = await pdf.getPage(pageNumber);
            if (request !== renderRequest) return;
            const baseViewport = page.getViewport({ scale: 1 });
            if (!Number.isFinite(baseViewport.width)
                || !Number.isFinite(baseViewport.height)
                || baseViewport.width < 72
                || baseViewport.width > 14_400
                || baseViewport.height < 72
                || baseViewport.height > 14_400) {
                throw new Error("Invalid PDF page dimensions");
            }
            const scale = height > 0
                ? Math.min(width / baseViewport.width, height / baseViewport.height)
                : width / baseViewport.width;
            const viewport = page.getViewport({ scale: Math.max(0.05, scale) });
            const devicePixelRatio = window.devicePixelRatio || 1;
            const outputScale = Math.max(
                0.05,
                Math.min(
                    Math.max(devicePixelRatio, 2),
                    2,
                    16384 / viewport.width,
                    16384 / viewport.height,
                    Math.sqrt(24_000_000 / (viewport.width * viewport.height)),
                ),
            );
            canvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
            canvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
            canvas.style.width = `${Math.floor(viewport.width)}px`;
            canvas.style.height = `${Math.floor(viewport.height)}px`;

            const renderTask = page.render({
                canvas,
                viewport,
                transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
            });
            renderTasks.add(renderTask);
            await renderTask.promise;
            renderTasks.delete(renderTask);
            if (request === renderRequest) {
                cacheCanvas(cacheKey, canvas);
                loading = false;
            }
        } catch (renderError) {
            if (request !== renderRequest
                || (renderError instanceof Error && renderError.name === "RenderingCancelledException")) return;
            console.error("Failed to render PDF preview", renderError);
            error = "Impossible d’afficher l’aperçu de ce reçu.";
            loading = false;
        }
    }

    function preparePreview(pdf: PDFDocumentProxy, config: RenderConfig) {
        if (!pagesElement || config.availableWidth <= 0) return;
        cancelRendering();
        const request = renderRequest;
        const ranges = config.layout?.pageRanges ?? [{ start: 1, end: pdf.numPages }];
        const pages = selectedPages(pdf.numPages, ranges);
        if (pages.length === 0) {
            error = "Aucune page à afficher.";
            loading = false;
            return;
        }

        error = null;
        loading = true;
        const fragment = document.createDocumentFragment();
        const targets = new Map<HTMLElement, ReturnType<typeof createPaper> & { pageNumber: number; cacheKey: string }>();
        let firstPageCached = false;
        for (const [index, pageNumber] of pages.entries()) {
            const paper = createPaper(pageNumber, config);
            const cacheKey = [
                documentRequest,
                pageNumber,
                Math.round(paper.width / 16) * 16,
                Math.round(paper.height / 16) * 16,
                Math.round((window.devicePixelRatio || 1) * 100),
            ].join(":");
            const cachedCanvas = canvasCache.get(cacheKey);
            if (cachedCanvas) {
                canvasCache.delete(cacheKey);
                canvasCache.set(cacheKey, cachedCanvas);
                cachedCanvas.setAttribute("aria-label", `${label}, page ${pageNumber}`);
                if (paper.target === paper.canvas) {
                    paper.target = cachedCanvas;
                } else {
                    paper.canvas.replaceWith(cachedCanvas);
                }
                paper.canvas = cachedCanvas;
                if (index === 0) firstPageCached = true;
            }
            fragment.append(paper.target);
            targets.set(paper.target, { ...paper, pageNumber, cacheKey });
        }
        pagesElement.replaceChildren(fragment);
        stopVisiblePageObserver = observeVisiblePage(
            viewportElement,
            new Map(Array.from(targets, ([target, page]) => [target, page.pageNumber])),
            onVisiblePage,
        );
        if (firstPageCached) loading = false;

        const startRendering = (target: HTMLElement) => {
            const page = targets.get(target);
            if (!page) return;
            if (canvasCache.has(page.cacheKey)) {
                loading = false;
                return;
            }
            if (renderingRequests.get(page.cacheKey) === request) return;
            renderingRequests.set(page.cacheKey, request);
            void renderPage(
                pdf,
                page.pageNumber,
                page.canvas,
                page.width,
                page.height,
                page.cacheKey,
                request,
            ).finally(() => {
                if (renderingRequests.get(page.cacheKey) === request) {
                    renderingRequests.delete(page.cacheKey);
                }
            });
        };
        if (!("IntersectionObserver" in window)) {
            for (const [target, page] of targets) {
                visibleCacheKeys.add(page.cacheKey);
                startRendering(target);
            }
            return;
        }
        pageObserver = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    const target = entry.target as HTMLElement;
                    const page = targets.get(target);
                    if (!page) continue;
                    if (entry.isIntersecting) {
                        visibleCacheKeys.add(page.cacheKey);
                        startRendering(target);
                    } else {
                        visibleCacheKeys.delete(page.cacheKey);
                        if (!canvasCache.has(page.cacheKey) && !renderingRequests.has(page.cacheKey)) {
                            page.canvas.width = 1;
                            page.canvas.height = 1;
                        }
                    }
                }
            },
            { root: viewportElement, rootMargin: "600px 0px" },
        );
        for (const target of targets.keys()) pageObserver.observe(target);
    }

    function retry() {
        void loadPDF(data);
    }

    function handleWheel(event: WheelEvent) {
        if (!event.ctrlKey) return;
        event.preventDefault();
        const nextZoom = clampZoom(zoom + (event.deltaY < 0 ? 0.1 : -0.1));
        if (nextZoom === zoom) return;
        zoom = nextZoom;
        pagesElement?.style.setProperty("zoom", String(nextZoom));
    }

    $effect(() => {
        void loadPDF(data);
    });

    $effect(() => {
        void renderKey;
        const pdf = pdfDocument;
        if (!pdf || viewportWidth <= 0 || (fit === "page" && viewportHeight <= 0)) return;
        preparePreview(pdf, {
            availableWidth: Math.max(240, viewportWidth - (fit === "page" ? 0 : 40)),
            availableHeight: fit === "page" ? Math.max(1, viewportHeight) : 0,
            fit,
            layout,
        });
    });

    onMount(() => {
        resizeObserver = new ResizeObserver(([entry]) => {
            const width = Math.round(entry.contentRect.width);
            const height = Math.round(entry.contentRect.height);
            if (width === viewportWidth && height === viewportHeight) return;
            if (resizeTimer !== null) window.clearTimeout(resizeTimer);
            resizeTimer = window.setTimeout(() => {
                viewportWidth = width;
                viewportHeight = height;
            }, 80);
        });
        resizeObserver.observe(viewportElement);
    });

    onDestroy(() => {
        documentRequest += 1;
        cancelRendering();
        resizeObserver?.disconnect();
        if (resizeTimer !== null) window.clearTimeout(resizeTimer);
        const task = loadingTask;
        loadingTask = null;
        disposeCanvasCache();
        if (task) void task.destroy().catch(() => undefined);
    });
</script>

<div
    bind:this={viewportElement}
    class="relative h-full min-h-0 overflow-auto p-5"
    title="Ctrl + molette pour zoomer"
    onwheel={handleWheel}
>
    <div bind:this={pagesElement} class="page-stack flex min-h-full flex-col items-center gap-5"></div>

    {#if loading}
        <div class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-(--light-bg2) text-sm text-(--grey)" aria-live="polite">
            <Icon.Loader2 size={20} class="ui-loader-spin" />
            Préparation de l’aperçu…
        </div>
    {:else if error}
        <div class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-(--light-bg2) px-6 text-center" role="alert">
            <p class="text-sm font-medium text-(--red)">{error}</p>
            <Button variant="secondary" size="sm" icon="RefreshCw" label="Réessayer" onclick={retry} />
        </div>
    {/if}
</div>

<style>
    .page-stack :global(canvas) {
        display: block;
        height: auto;
        background: white;
        border: 1px solid var(--light-bg3);
        border-radius: 0.35rem;
        box-shadow: 0 12px 32px rgb(15 23 42 / 8%);
    }

    .page-stack :global(.preview-paper) {
        position: relative;
        flex: none;
        overflow: hidden;
        background: white;
        border: 1px solid var(--light-bg3);
        border-radius: 0.2rem;
        box-shadow: 0 12px 32px rgb(15 23 42 / 10%);
    }

    .page-stack :global(.preview-content) {
        position: absolute;
        display: flex;
        align-items: center;
        justify-content: center;
        outline: 1px solid rgb(100 116 139 / 25%);
    }

    .page-stack :global(.preview-content canvas) {
        width: auto;
        height: auto;
        max-width: 100%;
        max-height: 100%;
        border: 0;
        border-radius: 0;
        box-shadow: none;
    }

    .page-stack :global(.preview-printable-area) {
        position: absolute;
        z-index: 2;
        pointer-events: none;
        border: 1px dashed rgb(37 99 235 / 65%);
        box-shadow: 0 0 0 9999px rgb(15 23 42 / 4%);
    }

    .page-stack :global(> canvas:first-child),
    .page-stack :global(.preview-paper:first-child) {
        margin-top: auto;
    }

    .page-stack :global(> canvas:last-child),
    .page-stack :global(.preview-paper:last-child) {
        margin-bottom: auto;
    }
</style>
