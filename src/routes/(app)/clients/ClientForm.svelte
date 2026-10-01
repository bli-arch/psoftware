<script lang="ts">
    import { goto } from "$app/navigation";
    import { apiGet, apiPost } from "$lib/api";
    import { normalizeBuilderPages } from "$lib/components/FormBuilder";
    import { normalizeFormConfig } from "$lib/formConfig";
    import { isPrivacyNoticeRequiredError } from "$lib/companyProfile";
    import { Button } from "$lib/components/istyler";
    import { onMount, tick, type Snippet } from "svelte";
    import { fly, slide } from "svelte/transition";
    import { Drawer, type DrawerDirection } from "vaul-svelte";
    import { animationTime } from "$lib/uiPreferences";
    import { toast } from "svelte-sonner";
    import * as Icon from "lucide-svelte";
    import StepProgress from "$lib/components/StepProgress.svelte";
    import OperationFormClientSaved from "../operations/OperationFormClientSaved.svelte";
    import OperationFormGrid from "../operations/OperationFormGrid.svelte";
    import OperationFormSummary from "../operations/OperationFormSummary.svelte";
    import {
        buildFieldLabelMap,
        countFilledRows,
        getFieldConfig,
        getSectionFields,
        getSectionPreview,
        getSummaryIcon,
        humanizeLabel,
        seedFormData,
        validateSectionDraft,
        type FieldLabelMap,
        type SummaryCard,
        type SummaryRow,
    } from "../operations/operationUtils";

    let {
        children,
        direction = "right",
        onCreated,
    }: {
        children: Snippet<[Record<string, any>]>;
        direction?: DrawerDirection;
        onCreated?: (client: Record<string, any>) => void;
    } = $props();

    let drawerOpen = $state(false);
    let formConfig = $state<Record<string, any> | null>(null);
    let formData = $state<Record<string, any>>({});
    let savedClient = $state<Record<string, any> | null>(null);
    let clientSaved = $state(false);
    let submitting = $state(false);
    let loadError = $state("");
    let formMissing = $state(false);
    let stepIndex = $state(0);
    let stepDirection = $state(1);
    let drawerContent: HTMLDivElement | null = $state(null);
    let fieldLabels = $state<FieldLabelMap>({ client: {}, data: {} });
    let openSections = $state<Record<string, boolean>>({});

    const pages = $derived(formConfig?.form?.pages ?? []);
    const maxStep = $derived(pages.length);
    const activePage = $derived(stepIndex < maxStep ? pages[stepIndex] : null);
    const isSummaryStep = $derived(stepIndex === maxStep);
    const clientFieldLabels = $derived({ ...fieldLabels.data, ...fieldLabels.client });
    const sectionTones: SummaryCard["tone"][] = ["blue", "amber", "green", "purple"];
    const workflowSteps = $derived([
        ...pages.map((page: any, index: number) => ({
            id: String(page.id ?? index),
            label: page.title ?? `Étape ${index + 1}`,
        })),
        { id: "summary", label: "Résumé" },
    ]);
    const summaryCards = $derived.by((): SummaryCard[] =>
        pages
            .map((page: any, pageIndex: number): SummaryCard | null => {
                const rows = getSectionFields(page)
                    .map((field: any): SummaryRow | null => {
                        const config = getFieldConfig(field);
                        if (!config.name) return null;

                        return {
                            id: config.name,
                            label: config.label ?? clientFieldLabels[config.name] ?? humanizeLabel(config.name),
                            value: formData[config.name],
                            display: config.displayValue ?? config.operationDisplay,
                            setting: config,
                        };
                    })
                    .filter((row: SummaryRow | null): row is SummaryRow => Boolean(row));

                if (!rows.length) return null;
                return {
                    id: `page-${pageIndex}`,
                    title: page.title ?? `Section ${pageIndex + 1}`,
                    preview: getSectionPreview(rows, "Aucune donnée renseignée"),
                    badge: `Étape ${pageIndex + 1}`,
                    stepIndex: pageIndex,
                    rows,
                    tone: sectionTones[pageIndex % sectionTones.length],
                    icon: getSummaryIcon(page),
                    iconColor: page.iconColor,
                };
            })
            .filter((card: SummaryCard | null): card is SummaryCard => Boolean(card))
    );
    const completedSummaryCards = $derived(summaryCards.filter((card) => countFilledRows(card.rows) === card.rows.length).length);
    const summaryFooterNote = $derived(
        summaryCards.length
            ? completedSummaryCards === summaryCards.length
                ? "Toutes les étapes sont complètes"
                : `${completedSummaryCards}/${summaryCards.length} sections complètes`
            : "Aucune donnée à vérifier"
    );

    $effect(() => {
        const next = { ...openSections };
        let changed = false;

        for (const card of summaryCards) {
            if (next[card.id] === undefined) {
                next[card.id] = card === summaryCards[0];
                changed = true;
            }
        }

        if (changed) openSections = next;
    });

    const resetDraft = () => {
        formData = {};
        seedFormData(pages, formData);
        savedClient = null;
        clientSaved = false;
        stepIndex = 0;
        stepDirection = 1;
        openSections = {};
    };

    const loadForm = async () => {
        loadError = "";
        formMissing = false;
        try {
            const config = normalizeFormConfig(await apiGet("/settings/form/active/client"));
            if (!config) {
                loadError = "La configuration du formulaire client est invalide.";
                formConfig = null;
                return;
            }

            config.form.pages = normalizeBuilderPages(config.form.pages);
            fieldLabels = buildFieldLabelMap(config.form.pages);
            formConfig = config;
            resetDraft();
        } catch (error: unknown) {
            console.error("Failed to load client form", error);
            if ((error as { status?: number })?.status === 404) formMissing = true;
            else loadError = "Impossible de charger le formulaire client.";
        }
    };

    onMount(() => {
        void loadForm();
    });

    const reportInvalidField = async (index = stepIndex) => {
        if (index !== stepIndex) {
            stepDirection = index > stepIndex ? 1 : -1;
            stepIndex = index;
        }
        await tick();
        const invalidField = drawerContent?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
            "input:invalid, select:invalid, textarea:invalid",
        );

        if (!invalidField) return false;
        invalidField.reportValidity();
        invalidField.focus();
        return true;
    };

    const firstInvalidStep = (targetIndex = maxStep) => {
        const end = Math.min(targetIndex, pages.length);
        for (let index = 0; index < end; index += 1) {
            if (!validateSectionDraft(pages[index], formData)) return index;
        }
        return null;
    };

    const goToStep = async (nextIndex: number) => {
        const boundedIndex = Math.max(0, Math.min(nextIndex, maxStep));
        if (boundedIndex === stepIndex) return;
        if (boundedIndex > stepIndex) {
            const invalidStep = firstInvalidStep(boundedIndex);
            if (invalidStep !== null) {
                await reportInvalidField(invalidStep);
                return;
            }
        }

        stepDirection = boundedIndex > stepIndex ? 1 : -1;
        stepIndex = boundedIndex;
    };

    const submitClient = async () => {
        if (submitting) return;
        const invalidStep = firstInvalidStep();
        if (invalidStep !== null) {
            await reportInvalidField(invalidStep);
            return;
        }

        submitting = true;
        try {
            const created = await apiPost("/core/clients/", {
                data: formData,
                form: formConfig?.id,
            });
            const createdClient = { ...created, data: created?.data ?? formData };
            savedClient = createdClient;
            clientSaved = true;
            onCreated?.(createdClient);
        } catch (error) {
            console.error("Failed to create client", error);
            toast.error(isPrivacyNoticeRequiredError(error)
                ? "La notice de confidentialité doit être vérifiée avant de créer un client."
                : "Impossible de créer le client.");
        } finally {
            submitting = false;
        }
    };

    const viewClient = () => {
        const uid = savedClient?.uid ?? savedClient?.id;
        if (!uid) return;
        drawerOpen = false;
        goto(`/clients/${uid}`);
    };
</script>

<Drawer.Root
    bind:open={drawerOpen}
    {direction}
    shouldScaleBackground
    closeThreshold={0}
    onOpenChange={(open: boolean) => {
        if (open && clientSaved) resetDraft();
    }}
>
    <Drawer.Trigger asChild let:builder>
        {@render children(builder)}
    </Drawer.Trigger>

    <Drawer.Portal>
        <Drawer.Overlay class="fixed inset-0 z-(--z-overlay) bg-black/40" />
        <Drawer.Content
            class="fixed inset-y-0 right-0 z-(--z-overlay) ml-auto h-full! w-5/6 max-w-none border-none bg-(--light-bg2) outline-none! select-text!"
            tabindex={-1}
        >
            <div
                in:slide={{ duration: 0 }}
                bind:this={drawerContent}
                data-vaul-no-drag
                class="flex h-full min-h-0 overflow-hidden font-(family-name:--font) text-(--dark-bg1)"
            >
                <main class="flex min-w-0 flex-1 flex-col overflow-hidden">
                    <div class="flex w-full flex-col items-start gap-4 border-b border-(--light-bg3) bg-(--light-bg1) px-5 py-4 sm:min-h-14 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-0">
                        <div class="text-lg font-bold font-(family-name:--font)">
                            {clientSaved ? "Client enregistré" : "Nouveau client"}
                        </div>

                        {#if !clientSaved && pages.length}
                            <StepProgress
                                steps={workflowSteps}
                                activeIndex={stepIndex}
                                onSelect={goToStep}
                            />
                        {/if}
                    </div>

                    <div class="relative min-h-0 flex-1 overflow-hidden">
                        {#if formMissing}
                            <div class="flex h-full items-center justify-center px-8 text-center text-sm text-(--grey)">Aucun formulaire détecté.</div>
                        {:else if loadError}
                            <div class="flex h-full items-center justify-center px-8 text-center">
                                <div class="max-w-sm">
                                    <Icon.AlertCircle size={24} class="mx-auto mb-3 text-(--red)" />
                                    <p class="text-sm font-semibold text-(--dark-bg1)">{loadError}</p>
                                    <Button variant="secondary" size="sm" icon="RefreshCw" label="Réessayer" class="mx-auto mt-4 w-fit" onclick={loadForm} />
                                </div>
                            </div>
                        {:else if clientSaved}
                            <div class="absolute inset-0 flex min-h-0 flex-col overflow-y-auto px-5 py-6 sm:px-10" in:fly={{ y: 12, duration: animationTime(220) }}>
                                <OperationFormClientSaved client={savedClient} />
                            </div>
                        {:else if formConfig}
                            {#key stepIndex}
                                <div
                                    class="absolute inset-0 flex min-h-0 flex-col overflow-y-auto px-5 py-6 sm:px-10"
                                    in:fly={{ x: stepDirection * 20, duration: animationTime(), delay: animationTime() }}
                                    out:fly={{ x: stepDirection * -20, duration: animationTime() }}
                                >
                                {#if activePage}
                                    <OperationFormGrid
                                        page={activePage}
                                        bind:data={formData}
                                    />
                                {:else if isSummaryStep}
                                    <OperationFormSummary
                                        {summaryCards}
                                        bind:openSections
                                        onEdit={goToStep}
                                        title="Résumé du client"
                                    />
                                {/if}
                                </div>
                            {/key}
                        {:else}
                            <div class="flex h-full items-center justify-center gap-2 text-sm text-(--grey)">
                                <Icon.Loader2 size={16} class="ui-loader-spin" />
                                Chargement du formulaire client...
                            </div>
                        {/if}
                    </div>

                    {#if !formMissing}
                    <div class="flex shrink-0 flex-col items-start justify-between gap-4 border-t border-(--light-bg3) bg-(--light-bg1) px-5 py-4 sm:h-15 sm:flex-row sm:items-center sm:px-10 sm:py-0">
                        {#if clientSaved}
                            <Drawer.Close asChild let:builder>
                                <Button
                                    {builder}
                                    variant="secondary"
                                    icon="X"
                                    label="Fermer"
                                    class="w-fit px-5 h-9 font-medium"
                                />
                            </Drawer.Close>
                            <div class="flex min-w-0 w-full flex-wrap items-center justify-between gap-3.5 sm:w-auto">
                                <Button variant="primary" class="w-fit px-5 h-9 font-medium" disabled={!savedClient} onclick={viewClient}>
                                    Voir le client
                                    <Icon.MoveRight size="14" />
                                </Button>
                            </div>
                        {:else if isSummaryStep}
                            <Button variant="secondary" class="w-fit px-5 h-9 font-medium" onclick={() => goToStep(stepIndex - 1)}>
                                <Icon.MoveLeft size="14" />
                                Précédent
                            </Button>

                            <div class="flex min-w-0 w-full flex-wrap items-center justify-between gap-3.5 sm:w-auto">
                                <span class="truncate whitespace-nowrap text-xs text-(--grey)">{summaryFooterNote}</span>
                                <Button
                                    variant="primary"
                                    class="bg-(--user-color) hover:bg-(--user-color-darker) w-fit px-5 h-9 font-medium"
                                    disabled={submitting || !formConfig}
                                    onclick={submitClient}
                                >
                                    {#if submitting}
                                        <Icon.Loader2 size="14" class="ui-loader-spin" />
                                    {:else}
                                        <Icon.Check size="16" />
                                    {/if}
                                    {submitting ? "Enregistrement..." : "Enregistrer"}
                                </Button>
                            </div>
                        {:else}
                            <div>
                                {#if stepIndex > 0}
                                    <Button variant="secondary" class="w-fit px-5 h-9 font-medium" onclick={() => goToStep(stepIndex - 1)}>
                                        <Icon.MoveLeft size="14" />
                                        Précédent
                                    </Button>
                                {:else}
                                    <Drawer.Close asChild let:builder>
                                        <Button {builder} variant="ghost" class="border-0 text-(--grey) hover:text-(--dark-bg1) w-fit px-0 h-9 font-medium">
                                            Annuler
                                        </Button>
                                    </Drawer.Close>
                                {/if}
                            </div>

                            <div class="flex min-w-0 w-full flex-wrap items-center justify-between gap-3.5 sm:w-auto">
                                <span class="truncate whitespace-nowrap text-xs text-(--grey)">
                                    {pages.length ? `${stepIndex + 1}/${pages.length}` : ""}
                                </span>
                                {#if stepIndex < maxStep}
                                    <Button variant="primary" class="w-fit px-5 h-9 font-medium" onclick={() => goToStep(stepIndex + 1)}>
                                        Suivant
                                        <Icon.MoveRight size="14" />
                                    </Button>
                                {/if}
                            </div>
                        {/if}
                    </div>
                    {/if}
                </main>
            </div>
        </Drawer.Content>
    </Drawer.Portal>
</Drawer.Root>
