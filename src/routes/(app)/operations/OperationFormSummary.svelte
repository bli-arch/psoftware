<script lang="ts">
    import { Accordion } from "bits-ui";
    import { getRowTone } from "$lib/components/settings/rowTone";
    import { Button } from "$lib/components/istyler";
    import MyAccordion from "$lib/components/MyAccordion.svelte";
    import DisplayValue from "$lib/components/table/DisplayValue.svelte";
    import { appSettings } from "$lib/settings";
    import { operationSingularLower } from "$lib/operationDisplay";
    import * as Icon from "lucide-svelte";
    import {
        countFilledRows,
        formatSummaryValue,
        getPageIconToneClass,
        getPageIconToneStyle,
        hasSummaryValue,
        type SummaryCard,
        type SummaryTone
    } from "./operationUtils";

    let {
        summaryCards = [],
        openSections = $bindable({ client: true }),
        onEdit,
        title,
        description = "Vérifiez chaque section avant d'enregistrer. Cliquez pour développer ou modifier."
    }: {
        summaryCards?: SummaryCard[];
        openSections?: Record<string, boolean>;
        onEdit?: (stepIndex: number) => void;
        title?: string;
        description?: string;
    } = $props();

    const toneClasses: Record<SummaryTone, string> = {
        orange: "bg-(--user-color)/10 text-(--user-color)",
        blue: "bg-(--blue)/10 text-(--blue)",
        amber: "bg-(--orange)/10 text-(--orange)",
        green: "bg-(--green)/10 text-(--green)",
        purple: "bg-(--dark-bg1)/5 text-(--dark-bg1)"
    };

    const iconTone = (card: SummaryCard) => getPageIconToneClass(card, toneClasses[card.tone]);

    const syncOpenSections = (value: string[]) => {
        openSections = Object.fromEntries(summaryCards.map((card) => [card.id, value.includes(card.id)]));
    };
</script>

<div class="mb-6">
    <h1 class="font-(family-name:--font) text-2xl font-bold tracking-tight text-(--dark-bg1)">
        {title ?? `Résumé de ${operationSingularLower($appSettings.value.operation)}`}
    </h1>
    <p class="text-sm leading-6 text-(--grey)">{description}</p>
</div>

<Accordion.Root
    type="multiple"
    value={summaryCards.filter((card) => openSections[card.id]).map((card) => card.id)}
    onValueChange={syncOpenSections}
    class="flex flex-col gap-2"
>
    {#each summaryCards as card (card.id)}
        {@const SummaryIcon = (Icon as any)[card.icon] ?? Icon.ClipboardList}
        <Accordion.Item
            value={card.id}
            class="overflow-hidden rounded-xl border border-(--light-bg3) bg-(--light-bg1) transition-(--transition)"
        >
            <Accordion.Header style={card.iconColor ? getPageIconToneStyle(card, true) : getRowTone(iconTone(card)).background}>
                <Accordion.Trigger
                    class="flex w-full cursor-pointer flex-col items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-(--light-bg2)/30 sm:flex-row sm:items-center"
                >
                    <div class="flex min-w-0 items-center gap-3">
                        <div class={`flex shrink-0 items-center justify-center ${getRowTone(iconTone(card)).iconClass}`} style={getPageIconToneStyle(card)} style:background-color="transparent">
                            <SummaryIcon size={20} strokeWidth={1.6} />
                        </div>
                        <span class="min-w-0 text-sm font-semibold text-(--dark-bg1)">{card.title}</span>
                    </div>

                    <div class="flex w-full min-w-0 items-center justify-between gap-2.5 sm:w-auto">
                        <span class="max-w-none truncate text-xs text-(--grey) sm:max-w-72">{card.preview}</span>
                        <span class="shrink-0 whitespace-nowrap rounded-full bg-(--dark-bg1)/5 px-2.5 py-0.5 text-xs font-medium text-(--grey)">
                            {card.id === "client"
                                ? card.badge
                                : `${card.badge} · ${countFilledRows(card.rows)}/${card.rows.length}`}
                        </span>
                        <Icon.ChevronDown
                            size="16"
                            class={`shrink-0 text-(--grey) transition-transform duration-(--animation-duration) ${
                                openSections[card.id] ? "rotate-180" : ""
                            }`}
                        />
                    </div>
                </Accordion.Trigger>
            </Accordion.Header>

            <MyAccordion>
                <div class="flex flex-col gap-2 px-4 pb-3.5 pt-4">
                    {#if card.rows.length}
                        <div class={`mb-3.5 grid gap-x-7 gap-y-3.5 ${card.rows.length <= 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
                            {#each card.rows as row (row.id)}
                                <div class={card.rows.length > 1 && card.rows.length % 2 === 1 && row === card.rows[card.rows.length - 1] ? "sm:col-span-2" : ""}>
                                    <div class="mb-1 text-xs font-semibold uppercase tracking-widest text-(--grey)">{row.label}</div>
                                    <div
                                        class={`whitespace-pre-wrap break-words text-sm leading-6 ${
                                            hasSummaryValue(row.value) ? "text-(--dark-bg1)" : "italic text-(--grey)"
                                        }`}
                                    >
                                        {#if row.display && hasSummaryValue(row.value)}
                                            <DisplayValue value={row.value} display={row.display} setting={row.setting} />
                                        {:else}
                                            {formatSummaryValue(row.value)}
                                        {/if}
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {:else}
                        <div class="rounded-lg border border-dashed border-(--light-bg3) px-4 py-3.5 text-sm italic text-(--grey)">
                            Aucune donnée à afficher.
                        </div>
                    {/if}

                    <Button
                        variant="ghost"
                        onclick={() => onEdit?.(card.stepIndex)}
                        class="w-fit text-xs text-(--grey) font-medium h-7 p-3 bg-(--dark-bg2)/5 hover:bg-(--user-color)/10 hover:text-(--user-color)"
                    >
                        <Icon.Pen size="12" />
                        Modifier cette étape
                    </Button>
                </div>
            </MyAccordion>
        </Accordion.Item>
    {/each}
</Accordion.Root>
