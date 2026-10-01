<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import { Accordion, Tabs } from "bits-ui";
    import * as Icon from "lucide-svelte";
    import { onMount } from "svelte";
    import { apiGet, apiPut } from "$lib/api";
    import { currentUser } from "$lib/auth";
    import { appSettings, bootstrapSettings } from "$lib/settings";
    import { CollapsibleSidebar } from "$lib/components/menu";
    import MyAccordion from "$lib/components/MyAccordion.svelte";
    import LucideIcon from "$lib/components/Badge/LucideIcon.svelte";
    import { FormPageAccordionTrigger, normalizeBuilderPages } from "$lib/components/FormBuilder";
    import {
        buildActivityPrivacyMap,
        type ActivityPrivacyMap,
    } from "$lib/components/activity/activityPrivacy";
    import { Button, inputTypesMapping, type InputType } from "$lib/components/istyler";
    import { operationPlural, operationPluralLower, operationSingularLower } from "$lib/operationDisplay";
    import { strftime } from "$lib/utils";
    import {
        buildClientDataSection,
        buildClientIdentityFields,
        buildFieldLabelMap,
        cloneValue,
        collectSectionChanges,
        formatDisplayedFieldValue,
        getClientName,
        getClientSecondaryName,
        getFieldConfig,
        getPagePreview,
        getPageIconToneClass,
        getPageIconToneStyle,
        getSectionFields,
        getSectionId,
        getSummaryIcon,
        getUserLabel,
        isPasswordField,
        normalizeRecord,
        seedSectionDraft,
        type ClientIdentityFields,
        validateSectionDraft,
    } from "../../operations/operationUtils";
    import ClientAbout from "./ClientAbout.svelte";
    import ClientActivity from "./ClientActivity.svelte";
    import ClientOperations from "./ClientOperations.svelte";

    let client: any = $state(null);
    let clientForm: any = $state(null);
    let pagesData: any[] = $state([]);
    let fallbackSection: any = $state(null);
    let accordionSections: any[] = $state([]);
    let openAccordionItems: string[] = $state([]);
    let operations: any[] = $state([]);
    let states: Array<Record<string, any>> = $state([]);
    let operationCount = $state(0);
    let loadError = $state("");
    let editingSectionId: string | null = $state(null);
    let editDrafts: Record<string, Record<string, any>> = $state({});
    let savingSections: Record<string, boolean> = $state({});
    let sectionErrors: Record<string, string | null> = $state({});
    let sectionForms: Record<string, HTMLFormElement | null> = $state({});
    let clientFieldLabels = $state<Record<string, string>>({});
    let clientIdentityFields = $state<ClientIdentityFields>({});
    let activePanel = $state("activity");
    let activityPanel: { refresh?: () => Promise<void> } | null = $state(null);
    let activityPrivacy = $state<ActivityPrivacyMap>({});
    let activityPrivacyReady = $state(false);

    const clientData = $derived(normalizeRecord(client?.data));
    const can = (key: string) => Boolean($currentUser?.administrator || $currentUser?.permissions?.includes(key));

    const getInputComponent = (type: string | undefined) =>
        type && type in inputTypesMapping ? inputTypesMapping[type as InputType] as any : null;

    const getFieldValue = (name: string) => clientData?.[name];

    const panelTitle = $derived(
        activePanel === "activity"
            ? "Activité"
            : activePanel === "about"
                ? "À propos"
                : operationPlural($appSettings.value.operation),
    );

    const panelSubtitle = $derived(
        activePanel === "activity"
            ? "Historique des actions sur ce client"
            : activePanel === "about"
                ? "Synthèse et informations du client"
                : `${operationCount} ${operationCount > 1 ? `${operationPluralLower($appSettings.value.operation)} liées` : `${operationSingularLower($appSettings.value.operation)} liée`}`,
    );

    const revealRightSidebar = (collapsed: boolean, onToggle: () => void) => {
        if (collapsed) onToggle();
    };

    const markLocalSection = (nextSource: Record<string, any>) => {
        if (!client) return;
        client = { ...client, data: nextSource };
    };

    const startSectionEdit = (section: any, sectionId: string) => {
        const draft = seedSectionDraft(section, clientData);
        editDrafts = { ...editDrafts, [sectionId]: draft };
        sectionErrors = { ...sectionErrors, [sectionId]: null };
        editingSectionId = sectionId;
        if (!openAccordionItems.includes(sectionId)) {
            openAccordionItems = [...openAccordionItems, sectionId];
        }
    };

    const cancelSectionEdit = (sectionId: string) => {
        const { [sectionId]: _draft, ...nextDrafts } = editDrafts;
        const { [sectionId]: _error, ...nextErrors } = sectionErrors;
        editDrafts = nextDrafts;
        sectionErrors = nextErrors;
        if (editingSectionId === sectionId) editingSectionId = null;
    };

    const saveSectionEdit = async (section: any, sectionId: string) => {
        if (!client || savingSections[sectionId]) return;
        const draft = editDrafts[sectionId] ?? {};
        const form = sectionForms[sectionId];

        if (!form?.checkValidity()) {
            form?.reportValidity();
            return;
        }

        if (!validateSectionDraft(section, draft)) {
            sectionErrors = { ...sectionErrors, [sectionId]: "Vérifiez les champs requis avant d'enregistrer." };
            return;
        }

        const previousSource = cloneValue(clientData);
        const changes = collectSectionChanges(section, previousSource, draft);
        if (!changes.length) {
            cancelSectionEdit(sectionId);
            return;
        }

        const nextSource = { ...previousSource, ...draft };
        savingSections = { ...savingSections, [sectionId]: true };
        sectionErrors = { ...sectionErrors, [sectionId]: null };

        try {
            markLocalSection(nextSource);
            await apiPut(`/core/clients/${client.uid}/`, {
                uid: client.uid,
                data: nextSource,
                form: client.form,
            });
            client = await apiGet(`/core/clients/${client.uid}/`);
            await activityPanel?.refresh?.();
            cancelSectionEdit(sectionId);
        } catch (error) {
            console.error("Failed to update client section", error);
            sectionErrors = { ...sectionErrors, [sectionId]: "Impossible d'enregistrer les modifications." };
            try {
                client = await apiGet(`/core/clients/${client.uid}/`);
            } catch {}
        } finally {
            savingSections = { ...savingSections, [sectionId]: false };
        }
    };

    const loadClient = async () => {
        const uid = page.params.uid;
        loadError = "";
        activityPrivacyReady = false;
        try {
            await bootstrapSettings();
            client = await apiGet(`/core/clients/${uid}/`);
            clientForm = client?.form
                ? await apiGet(`/settings/form/${client.form}`)
                : await apiGet("/settings/form/active/client").catch(() => null);

            if (clientForm?.form?.pages) {
                pagesData = normalizeBuilderPages(clientForm.form.pages).map((section: any) => ({
                    ...section,
                    type: "client",
                }));
                const labels = buildFieldLabelMap(pagesData);
                clientFieldLabels = { ...labels.data, ...labels.client };
                clientIdentityFields = buildClientIdentityFields(pagesData);
            }
            activityPrivacy = buildActivityPrivacyMap(pagesData);
            activityPrivacyReady = true;

            fallbackSection = buildClientDataSection(client.data ?? {}, Object.keys(client.data ?? {}), pagesData);
            accordionSections = pagesData.length ? pagesData : fallbackSection ? [fallbackSection] : [];
            openAccordionItems = accordionSections.length ? [getSectionId(accordionSections[0], 0)] : [];

            if (can("operations.view_details")) {
                const [related, loadedStates] = await Promise.all([
                    apiGet(
                        `/core/operations/?limit=8&filter_field=client.uid&filter_operator=equals&filter_value=${encodeURIComponent(client.uid)}`,
                    ).catch(() => ({ results: [], count: 0 })),
                    apiGet("/settings/state/").catch(() => ({ results: [] })),
                ]);
                operations = related?.results ?? [];
                operationCount = related?.count ?? operations.length;
                states = loadedStates?.results ?? loadedStates ?? [];
            }
        } catch (error) {
            console.error("Failed to load client", error);
            loadError = "Impossible de charger ce client.";
        }
    };

    $effect(() => {
        if (!$appSettings.value.clients.activity && activePanel === "activity") {
            activePanel = can("operations.view_details") ? "operations" : "about";
        }
        if (!can("operations.view_details") && activePanel === "operations") {
            activePanel = $appSettings.value.clients.activity ? "activity" : "about";
        }
    });

    onMount(loadClient);
</script>

<div class="flex h-full w-full flex-col overflow-hidden">
    <div class="flex h-12 shrink-0 items-center justify-between border-b border-(--light-bg3) bg-(--light-bg1) px-5">
        <Button
            variant="ghost"
            class="group flex p-0 pl-0.5 gap-1.5 text-(--grey) hover:text-(--dark-bg1)"
            onclick={() => goto("/clients")}
        >
            <Icon.MoveLeft size={15} class="transition-transform duration-(--animation-duration-150) group-hover:-translate-x-0.5" />
            Tous les clients
        </Button>
    </div>

    {#if loadError}
        <div class="flex flex-1 items-center justify-center px-6 text-center">
            <div class="max-w-sm">
                <Icon.AlertCircle size={24} class="mx-auto mb-3 text-(--red)" />
                <p class="text-sm font-semibold text-(--dark-bg1)">{loadError}</p>
                <Button variant="secondary" size="sm" icon="RefreshCw" label="Réessayer" class="mx-auto mt-4 w-fit" onclick={loadClient} />
            </div>
        </div>
    {:else if !client}
        <div class="flex flex-1 items-center justify-center gap-2 text-sm text-(--grey)">
            <Icon.Loader2 size={16} class="ui-loader-spin" />
            Chargement du client...
        </div>
    {:else}
        <div class="flex min-h-0 flex-1 overflow-hidden">
            <div class="flex min-w-0 flex-1 flex-col overflow-hidden">

                <section class="relative shrink-0 border-b border-(--light-bg3) bg-(--light-bg1) px-7 py-5">
                    <div class="absolute bottom-0 left-0 top-0 w-1 transition-colors duration-(--animation-duration-300)"></div>

                    <div class="flex items-start justify-between gap-5">
                        <div class="min-w-0">
                            <h1 class="truncate text-2xl font-bold leading-tight tracking-tight text-(--dark-bg1)">{getClientName(client, clientFieldLabels, clientIdentityFields)}</h1>
                            {#if getClientSecondaryName(client, clientIdentityFields)}
                                <p class="mt-0.5 truncate text-sm font-medium text-(--dark-bg1)/70">{getClientSecondaryName(client, clientIdentityFields)}</p>
                            {/if}
                            <p class="mt-1 text-xs font-medium text-(--grey)">{client.uid}</p>
                        </div>
                    </div>

                    <div class="mt-4 flex flex-wrap items-center gap-2.5 text-xs font-medium text-(--grey)">
                        <span class="flex items-center gap-1.5">
                            <Icon.Calendar size={12} />
                            {strftime(new Date(client.created_at), "%A %d %B %Y à %Hh%M", "fr-FR")}
                        </span>
                        <span class="text-(--light-grey) font-extralight">|</span>
                        <span class="flex items-center gap-1.5">
                            <Icon.UserRound size={12} />
                            Créée par <strong class="font-semibold text-(--dark-bg1)">{getUserLabel(client?.creator)}</strong>
                        </span>
                    </div>
                </section>

                <section class="min-h-0 flex-1 overflow-y-auto px-7 py-5">
                    {#if accordionSections.length}
                        <Accordion.Root
                            type="multiple"
                            value={openAccordionItems}
                            onValueChange={(value) => (openAccordionItems = value)}
                            class="flex flex-col gap-2"
                        >
                            {#each accordionSections as section, pageIndex}
                                {@const pageId = getSectionId(section, pageIndex)}
                                {@const isOpen = openAccordionItems.includes(pageId)}
                                {@const isEditing = editingSectionId === pageId}
                                {@const fields = getSectionFields(section)}

                                <Accordion.Item value={pageId} class="overflow-hidden rounded-xl border border-(--light-bg3) bg-(--light-bg1)">
                                    <Accordion.Header style={getPageIconToneStyle(section, true)}>
                                        <FormPageAccordionTrigger
                                            title={section.title ?? `Section ${pageIndex + 1}`}
                                            preview={getPagePreview(section, (_pageType, name) => getFieldValue(name))}
                                            icon={getSummaryIcon(section)}
                                            iconClass={getPageIconToneClass(section, "bg-(--page-icon-user-transparent) text-(--page-icon-user)")}
                                            iconStyle={getPageIconToneStyle(section)}
                                            open={isOpen}
                                        />
                                    </Accordion.Header>

                                    <MyAccordion>
                                        <div class="space-y-2 p-4">
                                            {#if isEditing}
                                                <form
                                                    bind:this={sectionForms[pageId]}
                                                    class="flex flex-col gap-4"
                                                    onsubmit={(event) => {
                                                        event.preventDefault();
                                                        saveSectionEdit(section, pageId);
                                                    }}
                                                >
                                                    <div class="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                                                        {#each fields as field}
                                                            {@const config = getFieldConfig(field)}
                                                            {@const InputComponent = getInputComponent(config.type)}
                                                            {#if InputComponent && config.name}
                                                                <div class={config.type === "dynamicgroup" || config.type === "textarea" || config.type === "text-area" ? "sm:col-span-2" : ""}>
                                                                    <InputComponent
                                                                        {...config}
                                                                        bind:value={editDrafts[pageId][config.name]}
                                                                    />
                                                                </div>
                                                            {/if}
                                                        {/each}
                                                    </div>

                                                    {#if sectionErrors[pageId]}
                                                        <div class="rounded-lg border border-(--red)/20 bg-(--red)/10 px-3 py-2 text-xs font-medium text-(--red)">
                                                            {sectionErrors[pageId]}
                                                        </div>
                                                    {/if}

                                                    <div class="flex justify-end gap-2 border-t border-(--light-bg3) pt-4">
                                                        <Button
                                                            variant="secondary"
                                                            size="sm"
                                                            class="w-fit"
                                                            label="Annuler"
                                                            disabled={savingSections[pageId]}
                                                            onclick={() => cancelSectionEdit(pageId)}
                                                        />
                                                        <Button
                                                            type="submit"
                                                            size="sm"
                                                            class="w-fit"
                                                            icon={savingSections[pageId] ? "Loader2" : "Check"}
                                                            iconAnimation={savingSections[pageId] ? "spin" : undefined}
                                                            label={savingSections[pageId] ? "Enregistrement..." : "Valider"}
                                                            disabled={savingSections[pageId]}
                                                        />
                                                    </div>
                                                </form>
                                            {:else}
                                                <div class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                                                    {#each fields as field}
                                                        {@const config = getFieldConfig(field)}
                                                        {@const fieldLabel = config.label ?? config.name}
                                                        {@const fieldValue = getFieldValue(config.name)}

                                                        {#if config.type === "dynamicgroup"}
                                                            <div class="sm:col-span-2">
                                                                <div class="mb-2 flex items-center gap-2">
                                                                    <div class="text-xs font-semibold uppercase tracking-widest text-(--grey)">{fieldLabel}</div>
                                                                    {#if Array.isArray(fieldValue)}
                                                                        <span class="rounded-full bg-(--light-bg3) px-2 py-px text-xs font-medium text-(--grey)">
                                                                            {fieldValue.length}
                                                                        </span>
                                                                    {/if}
                                                                </div>

                                                                {#if Array.isArray(fieldValue) && fieldValue.length}
                                                                    <div class="flex flex-col gap-2">
                                                                        {#each fieldValue as entry, idx}
                                                                            {@const subFields = config.fields ?? []}
                                                                            <div class="rounded-lg border border-(--light-bg3) bg-(--light-bg1) p-3">
                                                                                <span class="text-sm font-medium text-(--dark-bg1)">
                                                                                    {config.itemLabel ?? "Élément"} {idx + 1}
                                                                                </span>

                                                                                {#if subFields.length}
                                                                                    <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                                                        {#each subFields as subField}
                                                                                            <div class="text-xs">
                                                                                                <div class="mb-0.5 text-(--grey)">{subField.label ?? subField.name}</div>
                                                                                                <div class="break-words font-medium text-(--dark-bg1)">
                                                                                                    {formatDisplayedFieldValue(entry?.[subField.name], subField)}
                                                                                                </div>
                                                                                            </div>
                                                                                        {/each}
                                                                                    </div>
                                                                                {/if}
                                                                            </div>
                                                                        {/each}
                                                                    </div>
                                                                {:else}
                                                                    <div class="rounded-lg border border-dashed border-(--light-bg3) px-4 py-3 text-sm italic text-(--grey)">
                                                                        Aucune entrée.
                                                                    </div>
                                                                {/if}
                                                            </div>
                                                        {:else}
                                                            {@const displayedFieldValue = formatDisplayedFieldValue(fieldValue, config)}
                                                            <div class={config.type === "textarea" || config.type === "text-area" ? "sm:col-span-2" : ""}>
                                                                <div class="mb-1 text-xs font-semibold uppercase tracking-widest text-(--grey)">{fieldLabel}</div>
                                                                <div class="break-words text-sm leading-relaxed {displayedFieldValue === '-' ? 'italic text-(--grey)' : 'text-(--dark-bg1)'} {isPasswordField(config) ? 'font-mono font-semibold' : ''}">
                                                                    {displayedFieldValue}
                                                                </div>
                                                            </div>
                                                        {/if}
                                                    {/each}
                                                </div>
                                                {#if can("clients.modify")}
                                                    <Button
                                                        variant="ghost"
                                                        size="xs"
                                                        class="w-fit text-(--dark-bg1)/50 bg-(--light-bg3) hover:bg-(--user-color)/10 hover:text-(--user-color)"
                                                        icon="Pencil"
                                                        label="Modifier"
                                                        disabled={editingSectionId !== null}
                                                        onclick={() => startSectionEdit(section, pageId)}
                                                    />
                                                {/if}
                                            {/if}
                                        </div>
                                    </MyAccordion>
                                </Accordion.Item>
                            {/each}
                        </Accordion.Root>
                    {:else}
                        <div class="flex flex-col items-center justify-center gap-3 py-16 text-center">
                            <Icon.FileQuestion size={24} class="text-(--grey)" />
                            <div class="text-sm text-(--grey)">Aucune donnée client.</div>
                        </div>
                    {/if}
                </section>
            </div>

            <CollapsibleSidebar id="client-right-panel" side="right" width="420px" collapsedWidth="64px">
                {#snippet children({ collapsed, onToggle })}
                    <Tabs.Root value={activePanel} onValueChange={(value) => (activePanel = value)} class="flex h-full min-w-0">
                        <Tabs.List class="flex w-16 shrink-0 flex-col gap-1 px-2 py-3 {collapsed ? '' : 'border-r border-(--light-bg3)'}">
                            {#if $appSettings.value.clients.activity}
                                <Tabs.Trigger
                                    value="activity"
                                    title="Activité"
                                    onclick={() => revealRightSidebar(collapsed, onToggle)}
                                    class="nav-button flex size-10 cursor-pointer items-center justify-center rounded-lg text-(--grey) transition-colors hover:text-(--dark-bg1) {activePanel === 'activity' ? '--active text-(--dark-bg1)!' : ''}"
                                >
                                    <Icon.Activity size={17} />
                                </Tabs.Trigger>
                            {/if}
                            {#if can("operations.view_details")}
                                <Tabs.Trigger
                                    value="operations"
                                    title={operationPlural($appSettings.value.operation)}
                                    onclick={() => revealRightSidebar(collapsed, onToggle)}
                                    class="nav-button flex size-10 cursor-pointer items-center justify-center rounded-lg text-(--grey) transition-colors hover:text-(--dark-bg1) {activePanel === 'operations' ? '--active text-(--dark-bg1)!' : ''}"
                                >
                                    <LucideIcon name={$appSettings.value.operation.operationIcon as any} size={17} />
                                </Tabs.Trigger>
                            {/if}
                            <Tabs.Trigger
                                value="about"
                                title="À propos"
                                onclick={() => revealRightSidebar(collapsed, onToggle)}
                                class="nav-button flex size-10 cursor-pointer items-center justify-center rounded-lg text-(--grey) transition-colors hover:text-(--dark-bg1) {activePanel === 'about' ? '--active text-(--dark-bg1)!' : ''}"
                            >
                                <Icon.Info size={17} />
                            </Tabs.Trigger>
                        </Tabs.List>

                        {#if !collapsed}
                            <div class="flex min-w-0 flex-1 flex-col">
                                <div class="shrink-0 border-b border-(--light-bg3) px-4 py-3">
                                    <div class="text-sm font-semibold text-(--dark-bg1)">{panelTitle}</div>
                                    <div class="mt-0.5 text-xs font-normal leading-4 text-(--grey)">{panelSubtitle}</div>
                                </div>

                                <div class="min-h-0 flex-1">
                                    {#if $appSettings.value.clients.activity}
                                        <Tabs.Content value="activity" class="h-full">
                                            <ClientActivity
                                                bind:this={activityPanel}
                                                clientId={client.id}
                                                privacy={activityPrivacy}
                                                privacyReady={activityPrivacyReady}
                                            />
                                        </Tabs.Content>
                                    {/if}

                                    {#if can("operations.view_details")}
                                        <Tabs.Content value="operations" class="h-full">
                                            <ClientOperations
                                                {client}
                                                {operations}
                                                {states}
                                                canCreate={can("operations.create")}
                                                onCreated={() => void loadClient()}
                                            />
                                        </Tabs.Content>
                                    {/if}

                                    <Tabs.Content value="about" class="h-full">
                                        <ClientAbout
                                            {client}
                                            pagesData={accordionSections}
                                            {operationCount}
                                            canExport={can("clients.export")}
                                            canDelete={can("clients.delete")}
                                        />
                                    </Tabs.Content>
                                </div>
                            </div>
                        {/if}
                    </Tabs.Root>
                {/snippet}
            </CollapsibleSidebar>
        </div>
    {/if}
</div>
