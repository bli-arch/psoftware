<script lang="ts">
    import { Badge } from "$lib/components/Badge";
    import { Checkbox } from "$lib/components/istyler";
    import { appSettings } from "$lib/settings";
    import { strftime } from "$lib/utils";

    export let label: string | undefined = undefined;
    export let description = "Ajout du champ au reçu.";
    export let value: boolean | null | undefined = false;
    export let fieldLabel: string | null | undefined = undefined;
    export let receiptLabel: string | null | undefined = undefined;
    export let receiptFormat: string | null | undefined = undefined;
    export let fieldType: string | null | undefined = undefined;
    export let sampleValue: unknown = undefined;
    export let disabled = false;
    export let showPreview = true;
    export let showControl = true;

    $: enabled = Boolean(value);
    $: documentFormat = $appSettings.value.documents.receiptFormat;
    $: previewLabel = String(receiptLabel || fieldLabel || "Champ").trim() || "Champ";
    $: previewValue = formatSample(sampleValue, fieldType, receiptFormat);

    function formatSample(sample: unknown, type: string | null | undefined, format: string | null | undefined) {
        if (sample === false) return "Non";
        if (sample === true) return "Oui";
        if (sample === 0) return "0";
        if (sample === null || sample === undefined || sample === "") {
            if (type === "date" && format) return strftime(new Date(2026, 5, 12), format, "fr-FR");
            return "Valeur renseignée";
        }
        if (type === "date" && format) {
            try {
                return strftime(String(sample), format, "fr-FR");
            } catch {
                return "Date renseignée";
            }
        }
        if (Array.isArray(sample)) return sample.length ? sample.join(", ") : "Valeur renseignée";
        return String(sample);
    }
</script>

{#snippet preview()}
    <div
        data-settings-snap="receipt-preview"
        class="sticky top-0 z-30 -mx-5 h-48 shrink-0 overflow-hidden bg-(--light-bg1)"
        style="scroll-snap-align: start; scroll-snap-stop: always;"
    >
        <div class="relative z-20 flex h-16 items-center justify-between gap-4 px-5">
            <div class="min-w-0">
                {#if label}
                    <h3 class="text-xs font-semibold uppercase tracking-wide text-(--dark-bg1)">{label}</h3>
                {/if}
                <p class="truncate text-xs leading-4 text-(--grey)">{description}</p>
            </div>

            <div class="flex shrink-0 items-center gap-1.5">
                <Badge
                    text={documentFormat === "80mm" ? "80 mm" : "A4"}
                    type="neutral"
                    class="max-h-none px-2 py-1 text-[10px] font-normal uppercase tracking-wide text-(--grey)"
                />
                <Badge
                    text={enabled ? "Affiché" : "Masqué"}
                    type={enabled ? "success" : "neutral"}
                    class="max-h-none px-2 py-1 text-[10px] font-normal {enabled ? '' : 'text-(--grey)'}"
                />
            </div>
        </div>

        <div
            class="receipt-preview-stage absolute inset-x-0 bottom-0 top-16 overflow-hidden bg-(--light-bg2)"
            aria-label={`Aperçu du champ sur un reçu ${documentFormat === "80mm" ? "80 mm" : "A4"}`}
        >
            {#if documentFormat === "80mm"}
                <article class="receipt-ticket">
                    {#if enabled}
                        <div class="receipt-ticket-rule"></div>
                        <div class="receipt-ticket-heading">INFORMATIONS</div>
                        <div class="receipt-ticket-row">
                            <span>{previewLabel}</span>
                            <strong>{previewValue}</strong>
                        </div>
                    {/if}
                </article>
            {:else}
                <article class="receipt-a4">
                    {#if enabled}
                        <div class="receipt-a4-heading">INFORMATIONS</div>
                        <div class="receipt-a4-row">
                            <span>{previewLabel}</span>
                            <strong>{previewValue}</strong>
                        </div>
                    {/if}
                </article>
            {/if}

            <div class="pointer-events-none absolute inset-y-0 left-0 z-20 w-10 bg-gradient-to-r from-(--light-bg2) to-transparent"></div>
            <div class="pointer-events-none absolute inset-y-0 right-0 z-20 w-10 bg-gradient-to-l from-(--light-bg2) to-transparent"></div>
            <div class="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-8 bg-gradient-to-t from-(--light-bg2) to-transparent"></div>
        </div>
    </div>
{/snippet}

{#if showPreview}
    {@render preview()}
{/if}

{#if showControl}
    <div class="flex flex-col gap-3">
        <Checkbox
            {disabled}
            bind:value
            label="Afficher sur le reçu"
            switchMode
            side="left"
            helpText="Inclut ce champ dans le reçu lorsqu'il est renseigné."
        />
    </div>
{/if}

<style>
    .receipt-preview-stage {
        contain: layout paint;
    }

    .receipt-a4,
    .receipt-ticket {
        position: absolute;
        left: 50%;
        color: #1d2127;
        background: #fff;
        box-shadow: 0 8px 24px rgb(15 23 42 / 8%), 0 1px 2px rgb(15 23 42 / 10%);
    }

    .receipt-a4 {
        top: -18px;
        width: 680px;
        min-height: 230px;
        padding: 32px 48px;
        transform: translateX(-42%);
        font-family: "Red Hat Display", sans-serif;
    }

    .receipt-a4-heading {
        border-bottom: 1px solid rgb(29 33 39 / 55%);
        padding-bottom: 12px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.025em;
    }

    .receipt-a4-row {
        display: grid;
        grid-template-columns: 29% minmax(0, 1fr);
        min-height: 31px;
        align-items: start;
        gap: 12px;
        border-bottom: 1px solid #e5e8eb;
        padding: 8px 12px;
        font-size: 11px;
        line-height: 15px;
    }

    .receipt-a4-row > span {
        font-weight: 500;
    }

    .receipt-a4-row > strong {
        min-width: 0;
        font-weight: 400;
        overflow-wrap: anywhere;
    }

    .receipt-ticket {
        top: -15px;
        width: 310px;
        min-height: 260px;
        padding: 24px 19px;
        transform: translateX(-50%) scale(1.45);
        transform-origin: top center;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        color: #000;
    }

    .receipt-ticket-rule {
        height: 1px;
        background: repeating-linear-gradient(90deg, #000 0 7px, transparent 7px 11px);
    }

    .receipt-ticket-heading {
        margin: 16px 0 10px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.02em;
    }

    .receipt-ticket-row {
        display: grid;
        grid-template-columns: 104px minmax(0, 1fr);
        gap: 11px;
        border-bottom: 1px dotted #000;
        padding: 5px 0;
        font-size: 10px;
        line-height: 13px;
    }

    .receipt-ticket-row:last-child {
        border-bottom: 0;
    }

    .receipt-ticket-row > strong {
        min-width: 0;
        text-align: right;
        font-weight: 700;
        overflow-wrap: anywhere;
    }

</style>
