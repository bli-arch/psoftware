<script lang="ts">
    import { onDestroy, tick } from "svelte";
    import { Portal } from "bits-ui";
    import type { PDFDocumentLoadingTask, RenderTask } from "pdfjs-dist";
    import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
    import { PRINT_MAX_PAGE_COUNT, PRINT_MIN_PAGE_SIZE_INCHES, PRINT_PAPER_SIZES, type PrintDocumentMeta, type PrintMargins, type PrintRequest } from "$lib/printing";

    let {
        job,
        paperWidth,
        paperHeight,
        margins,
        onMetadata,
        onPending,
        onTextPages,
        onReady,
        onError,
    } = $props<{
        job: PrintRequest;
        paperWidth: number;
        paperHeight: number;
        margins: PrintMargins;
        onMetadata?: (meta: PrintDocumentMeta) => void;
        onPending?: () => void;
        onTextPages?: (pages: string[]) => void;
        onReady: (meta: PrintDocumentMeta) => void;
        onError: (message: string) => void;
    }>();

    let rootElement = $state<HTMLElement | null>(null);
    let pagesElement = $state<HTMLDivElement | null>(null);
    let loadingTask: PDFDocumentLoadingTask | null = null;
    const renderTasks = new Set<RenderTask>();
    let renderRequest = 0;
    let textRenderRequest = 0;

    function createTextPage(content: string) {
        const page = document.createElement("div");
        page.className = "native-print-page native-print-text-page";

        const article = document.createElement("article");
        article.className = "native-print-text";

        const pre = document.createElement("pre");
        pre.textContent = content;
        article.append(pre);
        page.append(article);
        return { page, pre };
    }

    const stopRendering = async () => {
        renderRequest += 1;
        for (const task of renderTasks) task.cancel();
        renderTasks.clear();
        const task = loadingTask;
        loadingTask = null;
        if (task) await task.destroy().catch(() => undefined);
    };

    const renderPDF = async () => {
        const data = job.data;
        const element = pagesElement;
        if (!data || !element) return;
        await stopRendering();
        const request = renderRequest;
        element.replaceChildren();
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (request !== renderRequest) return;

        try {
            const pdfjs = await import("pdfjs-dist");
            pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
            const task = pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) });
            loadingTask = task;
            const pdf = await task.promise;
            if (request !== renderRequest) return;
            if (pdf.numPages < 1 || pdf.numPages > PRINT_MAX_PAGE_COUNT) {
                throw new Error("Invalid PDF page count");
            }

            const fragment = document.createDocumentFragment();
            let naturalWidth = PRINT_PAPER_SIZES.a4.width;
            let naturalHeight = PRINT_PAPER_SIZES.a4.height;

            for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
                const page = await pdf.getPage(pageNumber);
                if (request !== renderRequest) return;

                const naturalViewport = page.getViewport({ scale: 1 });
                const pageWidth = naturalViewport.width / 72;
                const pageHeight = naturalViewport.height / 72;
                if (!Number.isFinite(pageWidth)
                    || !Number.isFinite(pageHeight)
                    || pageWidth < PRINT_MIN_PAGE_SIZE_INCHES
                    || pageWidth > 200
                    || pageHeight < PRINT_MIN_PAGE_SIZE_INCHES
                    || pageHeight > 200) {
                    throw new Error("Invalid PDF page dimensions");
                }
                if (pageNumber === 1) {
                    naturalWidth = pageWidth;
                    naturalHeight = pageHeight;
                    onMetadata?.({
                        pageCount: pdf.numPages,
                        width: naturalWidth,
                        height: naturalHeight,
                    });
                }
                const scale = Math.min(
                    200 / 72,
                    16384 / naturalViewport.width,
                    16384 / naturalViewport.height,
                    Math.sqrt(24_000_000 / (naturalViewport.width * naturalViewport.height)),
                    Math.sqrt(24_000_000 / pdf.numPages / (naturalViewport.width * naturalViewport.height)),
                );
                const viewport = page.getViewport({ scale });
                const canvas = document.createElement("canvas");
                canvas.width = Math.max(1, Math.floor(viewport.width));
                canvas.height = Math.max(1, Math.floor(viewport.height));
                canvas.setAttribute("aria-label", `${job.title}, page ${pageNumber} sur ${pdf.numPages}`);

                const pageElement = document.createElement("div");
                pageElement.className = "native-print-page";
                pageElement.append(canvas);
                fragment.append(pageElement);

                const renderTask = page.render({ canvas, viewport });
                renderTasks.add(renderTask);
                await renderTask.promise;
                renderTasks.delete(renderTask);
                if (request !== renderRequest) return;
            }

            element.replaceChildren(fragment);
            onReady({
                pageCount: pdf.numPages,
                width: naturalWidth,
                height: naturalHeight,
            });
        } catch (error) {
            if (request !== renderRequest) return;
            console.error("Failed to prepare PDF for printing", error);
            onError("Impossible de préparer ce document pour l’impression.");
        }
    };

    const renderText = async () => {
        const element = pagesElement;
        if (!element) return;
        const request = ++textRenderRequest;
        const content = job.content ?? "";
        onPending?.();
        onTextPages?.([]);
        element.replaceChildren();

        await tick();
        await document.fonts.ready;
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (request !== textRenderRequest) return;

        try {
            const pages: string[] = [];
            let offset = 0;

            do {
                if (pages.length >= PRINT_MAX_PAGE_COUNT) {
                    throw new Error("Text page count exceeds the supported limit");
                }

                const { page, pre } = createTextPage("");
                element.append(page);
                if (page.scrollHeight > page.clientHeight + 1) {
                    page.remove();
                    throw new Error("The printable area is too small for the document header");
                }

                const fits = (end: number) => {
                    pre.textContent = content.slice(offset, end);
                    return page.scrollHeight <= page.clientHeight + 1;
                };
                let low = offset;
                let high = Math.min(content.length, offset + 1_024);
                while (high < content.length && fits(high)) {
                    low = high;
                    high = Math.min(content.length, offset + (high - offset) * 2);
                }
                while (low < high) {
                    const middle = Math.floor((low + high + 1) / 2);
                    if (fits(middle)) {
                        low = middle;
                    } else {
                        high = middle - 1;
                    }
                }

                let end = low;
                if (end > offset && end < content.length) {
                    const previous = content.charCodeAt(end - 1);
                    const next = content.charCodeAt(end);
                    if ((previous >= 0xd800 && previous <= 0xdbff && next >= 0xdc00 && next <= 0xdfff)
                        || (content[end - 1] === "\r" && content[end] === "\n")) {
                        end -= 1;
                    }
                }
                // Avoid a synthetic blank line at the top of the following page.
                if (content.startsWith("\r\n", end)) {
                    end += 2;
                } else if (content[end] === "\r" || content[end] === "\n") {
                    end += 1;
                }
                page.remove();

                if (end === offset && offset < content.length) {
                    throw new Error("The printable area is too small for the document content");
                }

                pages.push(content.slice(offset, end));
                offset = end;
                if (pages.length % 20 === 0) {
                    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
                    if (request !== textRenderRequest) return;
                }
            } while (offset < content.length || pages.length === 0);

            if (request !== textRenderRequest) return;
            const fragment = document.createDocumentFragment();
            pages.forEach((pageContent) => {
                fragment.append(createTextPage(pageContent).page);
            });
            element.replaceChildren(fragment);
            onTextPages?.(pages);
            onReady({
                pageCount: pages.length,
                width: PRINT_PAPER_SIZES.a4.width,
                height: PRINT_PAPER_SIZES.a4.height,
            });
        } catch (error) {
            if (request !== textRenderRequest) return;
            console.error("Failed to paginate text for printing", error);
            onTextPages?.([]);
            onError("Impossible de paginer ce document pour l’impression.");
        }
    };

    $effect(() => {
        if (job.kind === "pdf" && pagesElement) void renderPDF();
    });

    $effect(() => {
        if (job.kind !== "text" || !rootElement || !pagesElement
            || paperWidth - margins.left - margins.right <= 0
            || paperHeight - margins.top - margins.bottom <= 0) return;
        void renderText();
    });

    onDestroy(() => {
        textRenderRequest += 1;
        void stopRendering();
    });
</script>

<Portal>
    <section
        bind:this={rootElement}
        data-native-print-root
        aria-hidden="true"
        class="native-print-root"
        style={`--print-page-width:${paperWidth}in;--print-page-height:${paperHeight}in;--print-content-width:${Math.max(0.1, paperWidth - margins.left - margins.right)}in;--print-content-height:${Math.max(0.1, paperHeight - margins.top - margins.bottom)}in`}
    >
        <div bind:this={pagesElement} class="native-print-pages"></div>
    </section>
</Portal>

<style>
    :global(.native-print-root) {
        position: fixed;
        top: 0;
        left: -100000px;
        width: var(--print-content-width);
        margin: 0;
        padding: 0;
        pointer-events: none;
        z-index: -1;
        background: white;
        color: #111827;
        font-family: Arial, sans-serif;
    }

    :global(.native-print-page) {
        display: flex;
        width: var(--print-content-width);
        height: var(--print-content-height);
        align-items: center;
        justify-content: center;
        overflow: hidden;
        break-after: page;
        page-break-after: always;
    }

    :global(.native-print-page:last-child) {
        break-after: auto;
        page-break-after: auto;
    }

    :global(.native-print-text-page) {
        display: block;
    }

    :global(.native-print-page canvas) {
        width: 100%;
        height: 100%;
        object-fit: contain;
    }

    :global(.native-print-text) {
        width: var(--print-content-width);
        margin: 0;
        font-size: 11pt;
        line-height: 1.55;
    }

    :global(.native-print-text pre) {
        margin: 0;
        overflow-wrap: anywhere;
        font: inherit;
        white-space: pre-wrap;
    }

    @media print {
        :global(html.psoft-printing body > :not([data-native-print-root])) {
            display: none !important;
        }

        :global(html.psoft-printing body) {
            margin: 0 !important;
            background: white !important;
        }

        :global(html.psoft-printing [data-native-print-root]) {
            position: static !important;
            display: block !important;
            width: var(--print-content-width) !important;
            color-adjust: exact;
            print-color-adjust: exact;
        }
    }
</style>
