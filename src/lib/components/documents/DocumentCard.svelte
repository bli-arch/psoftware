<script lang="ts">
    import { DOCUMENT_TYPE_LABELS, type OperationDocument } from "$lib/documents";
    import { strftime } from "$lib/utils";
    import * as Icon from "lucide-svelte";

    let {
        document,
        onOpen,
    } = $props<{
        document: OperationDocument;
        onOpen: () => void;
    }>();

    const title = $derived(DOCUMENT_TYPE_LABELS[document.document_type] ?? "Document");
    const documentDate = $derived(document.issued_at ?? document.created_at);
    const format = $derived(document.snapshot?.presentation?.format?.toLowerCase());
    const width = $derived(document.snapshot?.presentation?.width_mm);
    const height = $derived(document.snapshot?.presentation?.height_mm);
    const formatLabel = $derived(
        document.document_type === "tracking_label" && width && height
            ? `${width} × ${height} mm`
            : format === "80mm" ? "Ticket 80 mm" : format === "a4" ? "Format A4" : "",
    );
</script>

<button
    type="button"
    class="grid min-h-17 w-full {document.pdf_file ? 'grid-cols-[5.25rem_minmax(0,1fr)_2.75rem]' : 'grid-cols-[5.25rem_minmax(0,1fr)]'} overflow-hidden bg-(--light-bg1) text-left transition-colors duration-(--animation-duration-150) enabled:cursor-pointer enabled:hover:bg-(--light-bg2) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--user-color) disabled:cursor-default"
    disabled={!document.pdf_file}
    onclick={onOpen}
    aria-label={document.pdf_file ? `Ouvrir ${title}` : undefined}
>
    <span class="flex flex-col justify-center border-r border-(--light-bg3) px-2.5 py-2.5">
        <span class="text-xs font-bold text-(--dark-bg1)">{strftime(documentDate, "%d %B", "fr-FR")}</span>
        <span class="mt-0.5 text-[10px] text-(--grey)">{strftime(documentDate, "%Y · %Hh%M", "fr-FR")}</span>
    </span>

    <span class="block min-w-0 px-3 py-2.5">
        <span class="flex min-w-0 flex-wrap items-center gap-1.5">
            <span class="truncate text-[11px] font-medium text-(--grey)">{title}</span>
            {#if document.status === "draft"}
                <span class="rounded-md bg-(--light-bg3) px-1.5 py-0.5 text-[11px] font-semibold text-(--grey)">Brouillon</span>
            {:else if document.status === "cancelled"}
                <span class="rounded-md bg-(--transparent-red) px-1.5 py-0.5 text-[11px] font-semibold text-(--red)">Annulé</span>
            {/if}
        </span>
        <span class="mt-0.5 block truncate font-mono text-[11px] font-bold text-(--dark-bg1)">
            {document.number ?? "Référence en attente"}
        </span>
        {#if formatLabel}
            <span class="mt-1 block text-[11px] text-(--grey)">{formatLabel}</span>
        {/if}
    </span>

    {#if document.pdf_file}
        <span class="flex items-center justify-center">
            <Icon.Eye size={15} class="text-(--grey)" aria-hidden="true" />
        </span>
    {/if}
</button>
