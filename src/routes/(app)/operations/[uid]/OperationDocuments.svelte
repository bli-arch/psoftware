<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import { Dialog } from "bits-ui";
    import { toast } from "svelte-sonner";
    import { saveFile } from "$lib/backupFiles";
    import { Button } from "$lib/components/istyler";
    import DocumentCard from "$lib/components/documents/DocumentCard.svelte";
    import PdfPreview from "$lib/components/documents/PdfPreview.svelte";
    import MyDialog from "$lib/components/MyDialog.svelte";
    import {
        createReceipt,
        createTrackingLabel,
        DOCUMENT_TYPE_LABELS,
        downloadDocumentPDF,
        listDocuments,
        type OperationDocument,
    } from "$lib/documents";
    import { appSettings } from "$lib/settings";
    import { requestPrint } from "$lib/printing";
    import * as Icon from "lucide-svelte";

    let {
        operation,
        canCreate = false,
    } = $props<{
        operation: Record<string, any>;
        canCreate?: boolean;
    }>();

    let documents = $state<OperationDocument[]>([]);
    let loading = $state(true);
    let busyAction = $state<string | null>(null);
    let error = $state<string | null>(null);
    let viewerOpen = $state(false);
    let viewerLoading = $state(false);
    let viewerError = $state<string | null>(null);
    let viewedDocument = $state<OperationDocument | null>(null);
    let pdfData = $state<ArrayBuffer | null>(null);
    let savingPDF = $state(false);
    let viewerRequest = 0;
    const viewedTitle = $derived(viewedDocument ? DOCUMENT_TYPE_LABELS[viewedDocument.document_type] : "Document");

    export async function refresh() {
        if (!operation?.id) return;
        loading = true;
        error = null;
        try {
            documents = await listDocuments(operation.id);
        } catch (loadError) {
            console.error("Failed to load documents", loadError);
            error = "Impossible de charger les documents.";
        } finally {
            loading = false;
        }
    }

    const runAction = async (key: string, action: () => Promise<unknown>) => {
        if (busyAction) return;
        busyAction = key;
        error = null;
        try {
            await action();
            await refresh();
        } catch (actionError) {
            console.error("Document action failed", actionError);
            error = "Action impossible sur ce document.";
        } finally {
            busyAction = null;
        }
    };

    const releasePDF = () => {
        pdfData = null;
    };

    const openDocument = async (document: OperationDocument) => {
        const request = ++viewerRequest;
        releasePDF();
        viewedDocument = document;
        viewerOpen = true;
        viewerLoading = true;
        viewerError = null;
        try {
            const data = await downloadDocumentPDF(document.id);
            if (request !== viewerRequest || !viewerOpen) {
                return;
            }
            pdfData = data;
        } catch (loadError) {
            console.error("Failed to open document", loadError);
            if (request === viewerRequest) viewerError = "Impossible d’ouvrir ce document.";
        } finally {
            if (request === viewerRequest) viewerLoading = false;
        }
    };

    const handleViewerOpen = (open: boolean) => {
        viewerOpen = open;
        if (!open) {
            viewerRequest += 1;
            releasePDF();
            viewedDocument = null;
            viewerError = null;
        }
    };

    const saveDocumentPDF = async () => {
        if (!pdfData || !viewedDocument || savingPDF) return;
        const reference = String(viewedDocument.number ?? viewedDocument.id).replace(/[^a-zA-Z0-9_-]+/g, "-");
        const filePrefix = viewedDocument.document_type === "tracking_label" ? "etiquette" : "recu";
        savingPDF = true;
        try {
            const saved = await saveFile(pdfData, `${filePrefix}-${reference}.pdf`, `${viewedTitle} PSoft au format PDF`, ".pdf");
            if (saved) toast.success("Document enregistré.");
        } catch (saveError) {
            console.error("Failed to save document", saveError);
            toast.error("Impossible d’enregistrer le document.");
        } finally {
            savingPDF = false;
        }
    };

    const printPDF = () => {
        if (!pdfData || !viewedDocument) return;
        const isTrackingLabel = viewedDocument.document_type === "tracking_label";
        const width = viewedDocument.snapshot?.presentation?.width_mm ?? 0;
        const height = viewedDocument.snapshot?.presentation?.height_mm ?? 0;
        if (!requestPrint({
            type: isTrackingLabel ? "tracking-label" : "document",
            mode: "manual",
            kind: "pdf",
            title: viewedTitle,
            description: viewedDocument.number ?? "Document généré",
            data: pdfData,
            orientation: isTrackingLabel ? (width >= height ? "landscape" : "portrait") : undefined,
            paperSize: isTrackingLabel ? "document" : undefined,
        })) toast.error("Impossible de préparer cette impression.");
    };

    onMount(refresh);
    onDestroy(() => {
        viewerRequest += 1;
        releasePDF();
    });
</script>

<div class="flex h-full flex-col">
    <div class="min-h-0 flex-1 overflow-y-auto">
        <div class="grid gap-2 p-4">
            {#if $appSettings.value.documents.receiptsEnabled}
                <Button
                    variant="secondary"
                    size="sm"
                    class="w-full"
                    icon={busyAction === "receipt" ? "Loader2" : "ReceiptText"}
                    iconAnimation={busyAction === "receipt" ? "spin" : undefined}
                    label="Créer un reçu"
                    disabled={!canCreate || Boolean(busyAction)}
                    confirm
                    confirmTitle="Créer le reçu ?"
                    confirmDescription="Une fois créé, le reçu recevra un numéro définitif et ne pourra plus être modifié."
                    confirmCancelLabel="Annuler"
                    confirmConfirmLabel="Créer"
                    onclick={() => runAction("receipt", async () => openDocument(await createReceipt(operation.uid)))}
                />
            {/if}
            {#if $appSettings.value.documents.trackingLabelEnabled}
                <Button
                    variant="secondary"
                    size="sm"
                    class="w-full"
                    icon={busyAction === "tracking-label" ? "Loader2" : "Tag"}
                    iconAnimation={busyAction === "tracking-label" ? "spin" : undefined}
                    label="Créer une étiquette"
                    disabled={!canCreate || Boolean(busyAction)}
                    onclick={() => runAction("tracking-label", async () => {
                        const created = await createTrackingLabel(operation.uid, operation);
                        await openDocument(created.document);
                    })}
                />
            {/if}
        </div>

        {#if error}
            <div class="mx-4 mb-3 rounded-lg border border-(--red)/25 bg-(--red)/10 px-3 py-2 text-xs font-medium text-(--red)">
                {error}
            </div>
        {/if}

        {#if loading}
            <div class="flex flex-col items-center justify-center gap-3 py-16 text-center text-xs text-(--grey)">
                <Icon.Loader2 size={18} class="ui-loader-spin" />
                Chargement...
            </div>
        {:else if documents.length === 0}
            <div class="flex min-h-64 flex-col items-center justify-center gap-3 px-8 text-center">
                <div class="flex size-10 items-center justify-center rounded-xl border border-(--light-bg3) bg-(--light-bg2) text-(--grey)">
                    <Icon.Files size={18} />
                </div>
                <div>
                    <p class="text-sm font-semibold text-(--dark-bg1)">Aucun document</p>
                    <p class="mt-1 max-w-52 text-xs leading-5 text-(--grey)">Les reçus et étiquettes générés pour cette opération apparaîtront ici.</p>
                </div>
            </div>
        {:else}
            <div class="divide-y divide-(--light-bg3) border-y border-(--light-bg3)">
                {#each documents as document (document.id)}
                    <DocumentCard {document} onOpen={() => openDocument(document)} />
                {/each}
            </div>
        {/if}
    </div>
</div>

<Dialog.Root open={viewerOpen} onOpenChange={handleViewerOpen}>
    <Dialog.Portal>
        <MyDialog class="flex h-[86dvh]! max-h-205! w-[min(90vw,960px)]! max-w-none! flex-col overflow-hidden rounded-xl! p-0!">
            <header class="flex min-h-15 shrink-0 items-center justify-between gap-4 border-b border-(--light-bg3) px-5 py-3">
                <div class="min-w-0">
                    <Dialog.Title class="truncate text-base font-bold text-(--dark-bg1)">
                        {viewedTitle}
                    </Dialog.Title>
                    <Dialog.Description class="truncate text-xs text-(--grey)">
                        {viewedDocument?.number ?? "Document généré"}
                    </Dialog.Description>
                </div>
                <Dialog.Close>
                    {#snippet child({ props })}
                        <Button {...props} variant="ghost" icon="X" aria-label="Fermer" title="Fermer" class="size-8 shrink-0 bg-transparent px-0 hover:bg-(--light-bg3)" />
                    {/snippet}
                </Dialog.Close>
            </header>

            <div class="min-h-0 flex-1 overflow-hidden bg-(--light-bg2)">
                {#if viewerLoading}
                    <div class="flex h-full flex-col items-center justify-center gap-3 text-sm text-(--grey)">
                        <Icon.Loader2 size={20} class="ui-loader-spin" />
                        Chargement du document…
                    </div>
                {:else if viewerError}
                    <div class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center" role="alert">
                        <p class="text-sm font-medium text-(--red)">{viewerError}</p>
                        {#if viewedDocument}
                            <Button variant="secondary" size="sm" icon="RefreshCw" label="Réessayer" onclick={() => viewedDocument && openDocument(viewedDocument)} />
                        {/if}
                    </div>
                {:else if pdfData}
                    {#key viewedDocument?.id}
                        <PdfPreview data={pdfData} label={`${viewedTitle} ${viewedDocument?.number ?? ""}`} />
                    {/key}
                {/if}
            </div>

            <footer class="flex min-h-15 shrink-0 items-center justify-end gap-2 border-t border-(--light-bg3) bg-(--light-bg1) px-5 py-3">
                <Button
                    variant="secondary"
                    icon="Printer"
                    label="Imprimer"
                    disabled={!pdfData || savingPDF} onclick={printPDF}
                    class="w-fit"
                />
                <Button
                    icon={savingPDF ? "Loader2" : "Save"}
                    iconAnimation={savingPDF ? "spin" : undefined}
                    label={savingPDF ? "Enregistrement…" : "Enregistrer sous…"}
                    disabled={!pdfData || savingPDF}
                    onclick={saveDocumentPDF}
                    class="min-w-fit w-fit"
                />
            </footer>

        </MyDialog>
    </Dialog.Portal>
</Dialog.Root>
