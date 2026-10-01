<script lang="ts">
    import { Button } from "$lib/components/istyler";
    import PdfPreview from "$lib/components/documents/PdfPreview.svelte";
    import type { OperationDocument } from "$lib/documents";
    import { appSettings } from "$lib/settings";
    import { operationSingular } from "$lib/operationDisplay";
    import { onMount } from "svelte";
    import * as Icon from "lucide-svelte";
    import FormSuccess from "./FormSuccess.svelte";

    let {
        operation,
        receipt = null,
        pdfData = null,
        trackingLabel = null,
        trackingLabelPdfData = null,
        receiptLoading = false,
        trackingLabelLoading = false,
        receiptError = "",
        trackingLabelError = "",
        canCreateReceipt = false,
        canCreateTrackingLabel = false,
        creatingReceipt = false,
        onCreateReceipt,
        onCreateTrackingLabel,
        onRetryReceipt,
        onRetryTrackingLabel,
    }: {
        operation?: Record<string, any> | null;
        receipt?: OperationDocument | null;
        pdfData?: ArrayBuffer | null;
        trackingLabel?: OperationDocument | null;
        trackingLabelPdfData?: ArrayBuffer | null;
        receiptLoading?: boolean;
        trackingLabelLoading?: boolean;
        receiptError?: string;
        trackingLabelError?: string;
        canCreateReceipt?: boolean;
        canCreateTrackingLabel?: boolean;
        creatingReceipt?: boolean;
        onCreateReceipt?: () => void;
        onCreateTrackingLabel?: () => void;
        onRetryReceipt?: () => void;
        onRetryTrackingLabel?: () => void;
    } = $props();

    const operationRef = $derived(operation?.uid ?? operation?.id ?? operation?.pk ?? "");
    let successDelayElapsed = $state(false);
    const displayedDocument = $derived(trackingLabel ?? receipt);
    const displayedPdfData = $derived(trackingLabelPdfData ?? pdfData);
    const showDocumentPreview = $derived(Boolean(displayedPdfData && successDelayElapsed));
    const loading = $derived(receiptLoading || creatingReceipt || trackingLabelLoading);

    onMount(() => {
        const timer = window.setTimeout(() => (successDelayElapsed = true), 1750);
        return () => window.clearTimeout(timer);
    });
</script>

{#if showDocumentPreview}
    <div class="h-full min-h-0 w-full overflow-hidden">
        {#if displayedPdfData}
            {#key displayedDocument?.id}
                <PdfPreview data={displayedPdfData} label={`Document ${displayedDocument?.number ?? ""}`} fit="page" />
            {/key}
        {/if}
    </div>
{:else}
    <FormSuccess
        title={`${operationSingular($appSettings.value.operation)} enregistrée`}
        detail={operationRef ? String(operationRef) : undefined}
    >
        {#if loading}
            <div class="flex items-center justify-center gap-2 text-xs font-medium text-(--grey)" aria-live="polite">
                <Icon.LoaderCircle size="15" class="ui-loader-spin" />
                Création du document…
            </div>
        {:else if receiptError || trackingLabelError}
            <div class="flex flex-col items-center gap-3" role="alert">
                <p class="max-w-sm text-xs font-medium text-(--red)">{trackingLabelError || receiptError}</p>
                {#if trackingLabelError && onRetryTrackingLabel}
                    <Button variant="secondary" size="sm" icon="RefreshCw" label="Réessayer" class="w-fit" onclick={onRetryTrackingLabel} />
                {:else if onRetryReceipt}
                    <Button variant="secondary" size="sm" icon="RefreshCw" label="Réessayer" class="w-fit" onclick={onRetryReceipt} />
                {/if}
            </div>
        {:else if (canCreateReceipt && !receipt) || (canCreateTrackingLabel && !trackingLabel)}
            <div class="flex flex-wrap justify-center gap-2">
                {#if canCreateReceipt && !receipt}
                    <Button size="sm" icon="ReceiptText" label="Créer un reçu" class="w-fit" onclick={onCreateReceipt} />
                {/if}
                {#if canCreateTrackingLabel && !trackingLabel}
                    <Button size="sm" variant="secondary" icon="Tag" label="Créer une étiquette" class="w-fit" onclick={onCreateTrackingLabel} />
                {/if}
            </div>
        {/if}
    </FormSuccess>
{/if}
