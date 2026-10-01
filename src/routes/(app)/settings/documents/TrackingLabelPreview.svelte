<script lang="ts">
    import { onDestroy } from "svelte";
    import { createTrackingLabelPreview, type TrackingLabelField } from "$lib/trackingLabel";

    let { fields, width, height }: { fields: TrackingLabelField[]; width: number; height: number } = $props();

    let previewUrl = $state("");
    let previewError = $state(false);
    let renderSequence = 0;
    const sizeLabel = $derived(`${width} × ${height} mm`);
    const scale = $derived(Math.min(560 / width, 360 / height));
    const previewWidth = $derived(Math.round(width * scale));
    const previewHeight = $derived(Math.round(height * scale));
    const previewDpi = $derived(Math.min(900, Math.max(300, Math.ceil(scale * 25.4 * 2))));
    const barcodeEnabled = $derived(fields.some((field) => field.id === "system:barcode"));
    const contentCrowded = $derived(fields.length > Math.max(4, Math.floor(height / 5)));

    function replacePreviewUrl(nextUrl = "") {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = nextUrl;
    }

    $effect(() => {
        const currentFields = fields.map((field) => ({ ...field }));
        const currentWidth = width;
        const currentHeight = height;
        const currentDpi = previewDpi;
        const sequence = ++renderSequence;
        previewError = false;

        if (currentFields.length === 0) {
            replacePreviewUrl();
            return;
        }

        const timer = window.setTimeout(() => {
            void createTrackingLabelPreview(currentFields, currentWidth, currentHeight, currentDpi)
                .then((blob) => {
                    if (sequence !== renderSequence) return;
                    replacePreviewUrl(URL.createObjectURL(blob));
                })
                .catch((error) => {
                    if (sequence !== renderSequence) return;
                    console.error("Failed to render tracking label preview", error);
                    replacePreviewUrl();
                    previewError = true;
                });
        }, 80);

        return () => window.clearTimeout(timer);
    });

    onDestroy(() => {
        renderSequence += 1;
        replacePreviewUrl();
    });
</script>

<section class="min-w-0 rounded-lg border border-(--light-bg3) bg-(--light-bg2) p-4">
    <div class="flex items-center justify-between gap-3">
        <div class="text-xs font-semibold uppercase tracking-widest text-(--grey)">Aperçu</div>
        <div class="text-xs font-semibold text-(--grey)">{sizeLabel}</div>
    </div>

    <div class="flex min-h-80 items-center justify-center overflow-auto py-6">
        <div class="tracking-label" style={`width: ${previewWidth}px; height: ${previewHeight}px;`}>
            {#if previewUrl}
                <img
                    src={previewUrl}
                    alt={`Aperçu de l’étiquette ${sizeLabel}`}
                    width={previewWidth}
                    height={previewHeight}
                    draggable="false"
                />
            {:else if previewError}
                <div class="flex size-full items-center justify-center text-center text-sm font-medium text-black">
                    Aperçu indisponible.
                </div>
            {:else}
                <div class="flex size-full items-center justify-center text-center text-sm font-medium text-black">
                    {fields.length === 0 ? "Sélectionnez au moins un champ." : "Préparation de l’aperçu…"}
                </div>
            {/if}
        </div>
    </div>

    {#if barcodeEnabled && width < 35}
        <div class="mt-2 text-xs font-medium text-amber-700">
            Une largeur supérieure à 35 mm est recommandée pour préserver la lisibilité du code-barres.
        </div>
    {:else if contentCrowded}
        <div class="mt-2 text-xs font-medium text-amber-700">
            Le contenu risque d’être trop dense pour cette hauteur d’étiquette.
        </div>
    {/if}
</section>

<style>
    .tracking-label {
        flex: none;
        overflow: hidden;
        border-radius: 0.35rem;
        background: white;
        box-shadow: 0px 8px 20px 0px rgb(0 0 0 / 10%);
        color: #000;
        font-family: "Red Hat Display", sans-serif;
    }

    .tracking-label img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: fill;
    }
</style>
