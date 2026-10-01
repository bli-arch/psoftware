<script lang="ts">
    import { onDestroy, tick } from "svelte";
    import type { PrintMargins, PrintPageRange, PrintRect } from "$lib/printing";
    import { observeVisiblePage } from "./previewVisibility";

    let {
        pages,
        title,
        paperWidth,
        paperHeight,
        margins,
        printableArea,
        pageRanges,
        onVisiblePage,
    } = $props<{
        pages: string[];
        title: string;
        paperWidth: number;
        paperHeight: number;
        margins: PrintMargins;
        printableArea: PrintRect | null;
        pageRanges: PrintPageRange[];
        onVisiblePage?: (page: number) => void;
    }>();

    let viewportElement: HTMLDivElement;
    let observationRequest = 0;
    let stopVisiblePageObserver: (() => void) | null = null;

    const selectedPages = $derived.by(() => {
        const selected: number[] = [];
        for (const { start, end } of pageRanges) {
            for (let page = Math.max(1, start); page <= Math.min(pages.length, end); page += 1) {
                selected.push(page);
            }
        }
        return selected;
    });

    const percentage = (value: number, total: number) => `${value / total * 100}%`;
    const containerSize = (inches: number) => `${inches / paperWidth * 100}cqi`;
    const paperStyle = $derived([
        `aspect-ratio:${paperWidth}/${paperHeight}`,
        `--body-font:${containerSize(11 / 72)}`,
    ].join(";"));

    $effect(() => {
        const pagesToObserve = selectedPages;
        if (!viewportElement || pagesToObserve.length === 0) return;
        const request = ++observationRequest;
        stopVisiblePageObserver?.();
        stopVisiblePageObserver = null;

        void tick().then(() => {
            if (request !== observationRequest) return;
            const pageNumbers = new Map<HTMLElement, number>();
            for (const element of viewportElement.querySelectorAll<HTMLElement>("[data-preview-page]")) {
                const pageNumber = Number(element.dataset.previewPage);
                if (Number.isSafeInteger(pageNumber)) pageNumbers.set(element, pageNumber);
            }
            stopVisiblePageObserver = observeVisiblePage(viewportElement, pageNumbers, onVisiblePage);
        });
    });

    onDestroy(() => {
        observationRequest += 1;
        stopVisiblePageObserver?.();
    });
</script>

<div bind:this={viewportElement} class="h-full min-h-0 overflow-auto p-5">
    <div class="flex min-h-full flex-col items-center gap-5">
        {#each selectedPages as pageNumber}
            <article
                class="preview-paper relative w-[min(100%,430px)] shrink-0 overflow-hidden rounded-sm border border-(--light-bg3) bg-white text-[#111827] shadow-sm"
                style={paperStyle}
                data-preview-page={pageNumber}
                aria-label={`${title}, page ${pageNumber} sur ${pages.length}`}
            >
                <div
                    class="preview-content absolute overflow-hidden outline outline-1 outline-slate-400/20"
                    style:left={percentage(margins.left, paperWidth)}
                    style:right={percentage(margins.right, paperWidth)}
                    style:top={percentage(margins.top, paperHeight)}
                    style:bottom={percentage(margins.bottom, paperHeight)}
                >
                    <div class="text-page">
                        <pre>{pages[pageNumber - 1]}</pre>
                    </div>
                </div>

                {#if printableArea}
                    <div
                        class="pointer-events-none absolute z-2 border border-dashed border-blue-600/65"
                        title="Zone imprimable déclarée par le pilote"
                        style:box-shadow="0 0 0 9999px rgb(15 23 42 / 4%)"
                        style:left={percentage(printableArea.x, paperWidth)}
                        style:top={percentage(printableArea.y, paperHeight)}
                        style:width={percentage(printableArea.width, paperWidth)}
                        style:height={percentage(printableArea.height, paperHeight)}
                    ></div>
                {/if}

            </article>
        {/each}
    </div>
</div>

<style>
    .preview-paper {
        container-type: inline-size;
    }

    .preview-paper:first-child {
        margin-top: auto;
    }

    .preview-paper:last-child {
        margin-bottom: auto;
    }

    .text-page {
        width: 100%;
        margin: 0;
        font-family: Arial, sans-serif;
        font-size: var(--body-font);
        line-height: 1.55;
    }

    .text-page pre {
        margin: 0;
        overflow-wrap: anywhere;
        font: inherit;
        white-space: pre-wrap;
    }
</style>
