<script lang="ts">
    import { onMount } from "svelte";
    import { page } from "$app/state";
    import { goto } from "$app/navigation";
    import { Accordion, Popover, Tabs } from "bits-ui";
    import { apiGet, apiPut } from "$lib/api";
    import { currentUser } from "$lib/auth";
    import { appSettings, bootstrapSettings } from "$lib/settings";
    import { operationPluralLower, operationSingularLower } from "$lib/operationDisplay";
    import { strftime } from "$lib/utils";
    import { StateBadge } from "$lib/components/Badge";
    import { Button, Checkbox, inputTypesMapping, type InputType } from "$lib/components/istyler";
    import { FormPageAccordionTrigger, normalizeBuilderPages } from "$lib/components/FormBuilder";
    import {
        buildActivityPrivacyMap,
        type ActivityPrivacyMap,
    } from "$lib/components/activity/activityPrivacy";
    import {
        PANEL_META,
        buildAccordionSections,
        buildClientDataSection,
        cloneValue,
        collectSectionChanges,
        formatDisplayedFieldValue,
        getFieldConfig,
        getOperationClientCreator,
        getPageIconToneClass,
        getPageIconToneStyle,
        getPagePreview,
        getSectionFields,
        getSectionId,
        getSummaryIcon,
        getStateAccent,
        getUserLabel,
        groupKey,
        isPasswordField,
        normalizeRecord,
        seedSectionDraft,
        sortStates,
        validateSectionDraft,
    } from "../operationUtils";
    import MyAccordion from "$lib/components/MyAccordion.svelte";
    import MyPopover from "$lib/components/MyPopover.svelte";
    import LucideIcon from "$lib/components/Badge/LucideIcon.svelte";
    import OperationActivity from "./OperationActivity.svelte";
    import OperationNotes from "./OperationNotes.svelte";
    import OperationAbout from "./OperationAbout.svelte";
    import OperationDocuments from "./OperationDocuments.svelte";
    import OperationClientRow from "./OperationClientRow.svelte";
    import OperationTrackingRow from "./OperationTrackingRow.svelte";
    import type { OperationTracking } from "$lib/tracking";
    import { CollapsibleSidebar } from "$lib/components/menu";
    import DisplayValue from "$lib/components/table/DisplayValue.svelte";
    import * as Icon from "lucide-svelte";

    let operation: any = null;
    let currentForm: any = null;
    let clientForm: any = null;
    let pagesData: any[] = [];
    let clientPagesData: any[] = [];
    let clientData: Record<string, any> = {};
    let clientDataKeys: string[] = [];
    let clientDataSection: any = null;
    let accordionSections: any[] = [];
    let states: Array<Record<string, any>> = [];
    let orderedStates: Array<Record<string, any>> = [];
    let currentState: Record<string, any> | null = null;
    let currentStateColor = "transparent";
    let openAccordionItems: string[] = [];
    let updatingGroups: Record<string, boolean> = {};
    let updatingState = false;
    let statusPopoverOpen = false;
    let activePanel = "activity";
    let activities: any[] = [];
    let noteCount = 0;
    let operationTracking: OperationTracking | null = null;
    let trackingPanel: { refresh?: () => Promise<void> } | null = null;
    let activityPanel: { refresh?: () => Promise<void> } | null = null;
    let activityPrivacy: ActivityPrivacyMap = {};
    let activityPrivacyReady = false;
    let documentsPanel: { refresh?: () => Promise<void> } | null = null;
    let editingSectionId: string | null = null;
    let editDrafts: Record<string, Record<string, any>> = {};
    let savingSections: Record<string, boolean> = {};
    let sectionErrors: Record<string, string | null> = {};
    let sectionForms: Record<string, HTMLFormElement | null> = {};
    const can = (key: string) => Boolean($currentUser?.administrator || $currentUser?.permissions?.includes(key));
    const canEditSection = (section: any) => section?.type === "client" ? can("clients.modify") : can("operations.modify");
    const operationActivityEnabled = () => $appSettings.value.operation.operationActivityEnabled;
    const operationNotesVisible = () => $appSettings.value.operation.notesEnabled && can("operations.add_notes");
    const fallbackPanel = () => operationNotesVisible() ? "notes" : "documents";

    const revealRightSidebar = (collapsed: boolean, onToggle: () => void) => {
        if (collapsed) onToggle();
    };

    const changePanel = (value: string) => {
        const previousPanel = activePanel;
        activePanel = value;
        if (value === "documents" && previousPanel !== "documents") {
            documentsPanel?.refresh?.();
        }
    };

    const panelSubtitle = (panel: string) => {
        if (panel === "activity") return `Historique des actions sur les ${operationPluralLower($appSettings.value.operation)}`;
        if (panel === "about") return `Synthèse et statistiques de ${operationSingularLower($appSettings.value.operation)}`;
        return PANEL_META[panel]?.subtitle;
    };

    const pickDataSource = (pageType?: string): Record<string, any> =>
        pageType === "client" ? operation?.client?.data ?? {} : operation?.data ?? {};

    const getFieldValue = (pageType: string | undefined, name: string) =>
        pickDataSource(pageType)?.[name];

    const getInputComponent = (type: string | undefined) =>
        type && type in inputTypesMapping ? inputTypesMapping[type as InputType] as any : null;

    const persistDynamicGroup = async (pageType: string | undefined, dataPayload: Record<string, any>) => {
        if (!operation) return;
        if (pageType === "client") {
            const clientUid = operation.client?.uid;
            if (!clientUid) return;
            await apiPut(`/core/clients/${clientUid}/`, {
                uid: clientUid,
                data: dataPayload,
                form: operation.client?.form,
                creator: getOperationClientCreator(operation),
            });
        } else {
            await apiPut(`/core/operations/${operation.uid}/`, {
                uid: operation.uid,
                data: dataPayload,
                client: operation.client?.id ?? operation.client,
                form: operation.form,
                state: operation.state,
            });
        }
    };

    const markLocalGroupItem = (pageType: string | undefined, fieldName: string, items: any[]) => {
        if (!operation) return;
        if (pageType === "client") {
            operation = {
                ...operation,
                client: { ...(operation.client ?? {}), data: { ...(operation.client?.data ?? {}), [fieldName]: items } },
            };
        } else {
            operation = { ...operation, data: { ...(operation.data ?? {}), [fieldName]: items } };
        }
    };

    const markLocalSection = (pageType: string | undefined, nextSource: Record<string, any>) => {
        if (!operation) return;
        if (pageType === "client") {
            operation = {
                ...operation,
                client: {
                    ...(operation.client ?? {}),
                    data: nextSource,
                },
            };
            return;
        }

        operation = { ...operation, data: nextSource };
    };

    const startSectionEdit = (section: any, sectionId: string) => {
        const draft = seedSectionDraft(section, pickDataSource(section.type));
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
        if (editingSectionId === sectionId) {
            editingSectionId = null;
        }
    };

    const saveSectionEdit = async (section: any, sectionId: string) => {
        if (!operation || savingSections[sectionId]) return;
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

        const previousSource = cloneValue(pickDataSource(section.type));
        const changes = collectSectionChanges(section, previousSource, draft);

        if (!changes.length) {
            cancelSectionEdit(sectionId);
            return;
        }

        const nextSource = { ...previousSource, ...draft };
        savingSections = { ...savingSections, [sectionId]: true };
        sectionErrors = { ...sectionErrors, [sectionId]: null };

        try {
            markLocalSection(section.type, nextSource);
            await persistDynamicGroup(section.type, nextSource);
            operation = await apiGet(`/core/operations/${operation.uid}/`);
            await activityPanel?.refresh?.();
            await trackingPanel?.refresh?.();
            cancelSectionEdit(sectionId);
        } catch (e) {
            console.error("Failed to update section", e);
            sectionErrors = { ...sectionErrors, [sectionId]: "Impossible d'enregistrer les modifications." };
            try {
                operation = await apiGet(`/core/operations/${operation.uid}/`);
            } catch {}
        } finally {
            savingSections = { ...savingSections, [sectionId]: false };
        }
    };

    const toggleCheckableItem = async (
        pageType: string | undefined,
        fieldName: string,
        index: number,
        nextValue?: boolean,
    ) => {
        if (!operation) return;
        const key = groupKey(pageType, fieldName, index);
        updatingGroups = { ...updatingGroups, [key]: true };

        try {
            const source = pageType === "client"
                ? { ...(operation.client?.data ?? {}) }
                : { ...(operation.data ?? {}) };
            const items = Array.isArray(source[fieldName]) ? source[fieldName].map((item: any) => ({ ...item })) : [];

            if (!items[index]) return;
            items[index] = { ...items[index], done: nextValue ?? !items[index].done };
            source[fieldName] = items;

            markLocalGroupItem(pageType, fieldName, items);
            await persistDynamicGroup(pageType, source);
            operation = await apiGet(`/core/operations/${operation.uid}/`);
            await activityPanel?.refresh?.();
            await trackingPanel?.refresh?.();
        } catch (e) {
            console.error("Failed to update item", e);
            try {
                operation = await apiGet(`/core/operations/${operation.uid}/`);
            } catch {}
        } finally {
            updatingGroups = { ...updatingGroups, [key]: false };
        }
    };

    const changeState = async (state: Record<string, any>) => {
        if (!operation || state.id === operation.state || updatingState) return;
        const nextStateId = state.id;
        updatingState = true;
        statusPopoverOpen = false;

        try {
            await apiPut(`/core/operations/${operation.uid}/`, {
                uid: operation.uid,
                data: operation.data ?? {},
                client: operation.client?.id ?? operation.client,
                form: operation.form,
                state: nextStateId,
            });
            operation = { ...operation, state: nextStateId };
            await activityPanel?.refresh?.();
            await trackingPanel?.refresh?.();
        } catch (e) {
            console.error("Failed to update state", e);
        } finally {
            updatingState = false;
        }
    };

    $: clientData = normalizeRecord(operation?.client?.data);
    $: clientDataKeys = Object.keys(clientData);
    $: clientDataSection = buildClientDataSection(clientData, clientDataKeys, clientPagesData);
    $: accordionSections = buildAccordionSections(clientDataSection, pagesData, clientDataKeys);
    $: orderedStates = sortStates(states);
    $: currentState = operation ? orderedStates.find((state) => state.id === operation.state) ?? null : null;
    $: currentStateColor = getStateAccent(currentState);
    $: if (!operationActivityEnabled() && activePanel === "activity") activePanel = fallbackPanel();
    $: if (!operationNotesVisible() && activePanel === "notes") activePanel = operationActivityEnabled() ? "activity" : "about";

    onMount(async () => {
        const uid = page.params.uid;
        activityPrivacyReady = false;
        try {
            await bootstrapSettings();
            operation = await apiGet(`/core/operations/${uid}/`);
            currentForm = await apiGet(`/settings/form/${operation.form}`);
            if (operation.client?.form) {
                clientForm = await apiGet(`/settings/form/${operation.client.form}`);
            } else {
                clientForm = await apiGet("/settings/form/active/client").catch(() => null);
            }
            states = await apiGet("/settings/state/").then((response) => response.results ?? response);
            if (currentForm?.form?.pages) {
                pagesData = normalizeBuilderPages(currentForm.form.pages);
            }
            if (clientForm?.form?.pages) {
                clientPagesData = normalizeBuilderPages(clientForm.form.pages);
            }
            const loadedClientData = normalizeRecord(operation?.client?.data);
            const loadedClientDataKeys = Object.keys(loadedClientData);
            const loadedClientSection = buildClientDataSection(loadedClientData, loadedClientDataKeys, clientPagesData);
            const loadedSections = buildAccordionSections(loadedClientSection, pagesData, loadedClientDataKeys)
                .filter((section) => section.type !== "client");
            openAccordionItems = loadedSections.length ? [getSectionId(loadedSections[0], 0)] : [];
        } catch (e) {
            console.error("Failed to load operation", e);
        } finally {
            activityPrivacy = buildActivityPrivacyMap([...pagesData, ...clientPagesData]);
            activityPrivacyReady = true;
        }
    });
</script>

<div class="flex h-full w-full flex-col overflow-hidden">
    <div class="flex h-12 shrink-0 items-center border-b border-(--light-bg3) bg-(--light-bg1) px-5">

        <Button
            variant="ghost"
            class="group flex p-0 pl-0.5 gap-1.5 text-(--grey) hover:text-(--dark-bg1)"
            onclick={() => goto("/operations")}
        >
            <Icon.MoveLeft size={15} class="transition-transform duration-(--animation-duration-150) group-hover:-translate-x-0.5" />
            {`Toutes les ${operationPluralLower($appSettings.value.operation)}`}
        </Button>
    </div>

    {#if !operation || !currentForm}
        <div class="flex flex-1 items-center justify-center gap-2 text-sm text-(--grey)">
            <Icon.Loader2 size={16} class="ui-loader-spin" />
            Chargement de {operationSingularLower($appSettings.value.operation)}...
        </div>
    {:else}
        <div class="flex min-h-0 flex-1 overflow-hidden">
            <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
                <section
                    class="relative shrink-0 border-b border-(--light-bg3) px-7 py-5"
                    style:background={`linear-gradient(135deg, ${currentStateColor} -48%, var(--light-bg1) 16%)`}
                >
                    <div class="flex items-start justify-between gap-5">
                        <div class="min-w-0">
                            <h1 class="break-all text-2xl font-bold leading-tight tracking-tight text-(--dark-bg1)">#{operation.uid}</h1>
                        </div>

                        {#if can("operations.change_status")}
                            <Popover.Root bind:open={statusPopoverOpen}>
                                <Popover.Trigger class="group/status mt-1 flex shrink-0 cursor-pointer items-center focus:outline-none">
                                    <StateBadge state={operation.state} states={orderedStates} class="px-2.5 py-1 text-xs font-medium">
                                        <LucideIcon
                                            size={12}
                                            name="ChevronDown"
                                            className="ml-1 transition-transform duration-(--animation-duration) group-data-[state=open]/status:rotate-180"
                                        />
                                    </StateBadge>
                                </Popover.Trigger>
                                <MyPopover class="min-w-52 max-w-[calc(100vw-3rem)] items-stretch rounded-lg p-1" align="end">
                                    <div class="flex max-h-80 w-full flex-col gap-0.5 overflow-y-auto">
                                        {#each orderedStates as state (state.id)}
                                            {@const stateColor = getStateAccent(state, "var(--grey)")}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                class="w-full cursor-pointer justify-start gap-2 rounded-md px-2 text-left hover:bg-(--status-color)/10 disabled:cursor-default disabled:bg-(--light-bg2)"
                                                style={`--status-color:${stateColor}`}
                                                disabled={state.id === operation.state || updatingState}
                                                confirm={state.id !== operation.state}
                                                confirmTitle="Changer le statut ?"
                                                confirmCancelLabel="Annuler"
                                                confirmConfirmLabel="Valider"
                                                confirmCancelVariant="secondary"
                                                confirmConfirmVariant="primary"
                                                onclick={() => changeState(state)}
                                            >
                                                <LucideIcon
                                                    size={14}
                                                    name={state.settings?.icon}
                                                    class="shrink-0"
                                                    style={`color:${stateColor}`}
                                                />
                                                <span class="min-w-0 flex-1 truncate text-xs font-medium text-(--dark-bg1)">{state.name ?? `Statut ${state.id}`}</span>
                                                {#if state.id === operation.state}
                                                    <Icon.Check size={13} class="shrink-0 text-(--green)" />
                                                {/if}
                                                <span slot="confirmDescription" class="inline-flex flex-wrap items-center gap-1.5">
                                                    Le statut de {operationSingularLower($appSettings.value.operation)} passera de
                                                    <StateBadge state={operation.state} states={orderedStates} />
                                                    à
                                                    <StateBadge state={state.id} states={orderedStates} />
                                                </span>
                                            </Button>
                                        {/each}
                                    </div>
                                </MyPopover>
                            </Popover.Root>
                        {:else}
                            <div class="mt-1 flex shrink-0 items-center">
                                <StateBadge state={operation.state} states={orderedStates} class="rounded-full px-2.5 py-1 text-xs font-medium">
                                </StateBadge>
                            </div>
                        {/if}
                    </div>

                    <div class="mt-4 flex flex-wrap items-center gap-2.5 text-xs font-medium text-(--grey)">
                        <span class="flex items-center gap-1.5">
                            <Icon.Calendar size={12} />
                            {strftime(new Date(operation.created_at), "%A %d %B %Y à %Hh%M", "fr-FR")}
                        </span>
                        <span class="text-(--light-grey) font-extralight">|</span>
                        <span class="flex items-center gap-1.5">
                            <Icon.UserRound size={12} />
                            Créée par <strong class="font-semibold text-(--dark-bg1)">{getUserLabel(operation?.creator)}</strong>
                        </span>
                    </div>
                </section>

                <section class="min-h-0 flex-1 overflow-y-auto px-7 py-5">
                    <OperationTrackingRow bind:this={trackingPanel} uid={operation.uid} onChanged={(value) => (operationTracking = value)} />
                    {#if operation.client?.uid || accordionSections.length}
                        <Accordion.Root
                            type="multiple"
                            value={openAccordionItems}
                            onValueChange={(value) => (openAccordionItems = value)}
                            class="flex flex-col gap-2"
                        >
                            {#if operation.client?.uid}
                                <OperationClientRow client={operation.client} pages={clientPagesData} />
                            {/if}
                            {#each accordionSections.filter((section) => section.type !== "client") as section, pageIndex}
                                {@const pageId = getSectionId(section, pageIndex)}
                                {@const isOpen = openAccordionItems.includes(pageId)}
                                {@const isEditing = editingSectionId === pageId}
                                {@const fields = getSectionFields(section)}
                                <Accordion.Item value={pageId} class="overflow-hidden rounded-xl border border-(--light-bg3) bg-(--light-bg1)">
                                    <Accordion.Header style={getPageIconToneStyle(section, true)}>
                                        
                                        <FormPageAccordionTrigger
                                            title={section.title ?? `Section ${pageIndex + 1}`}
                                            preview={getPagePreview(section, getFieldValue)}
                                            icon={getSummaryIcon(section)}
                                            iconClass={getPageIconToneClass(section, "bg-(--page-icon-user-transparent) text-(--page-icon-user)")}
                                            iconStyle={getPageIconToneStyle(section)}
                                            open={isOpen}
                                        />

                                    </Accordion.Header>

                                    <MyAccordion>
                                        <div class="p-4 space-y-2">
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
                                                            confirm
                                                            confirmTitle="Confirmer l'annulation"
                                                            confirmDescription="Les modifications non enregistrées de cette section seront perdues."
                                                            confirmCancelLabel="Retour"
                                                            confirmConfirmLabel="Annuler"
                                                            confirmCancelVariant="secondary"
                                                            confirmConfirmVariant="error"
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
                                                            confirm
                                                            confirmTitle="Confirmer les modifications"
                                                            confirmDescription="Les changements de cette section vont être enregistrés."
                                                            confirmCancelLabel="Annuler"
                                                            confirmConfirmLabel="Valider"
                                                            confirmCancelVariant="secondary"
                                                            confirmConfirmVariant="primary"
                                                        />
                                                    </div>
                                                </form>
                                            {:else}
                                            <div class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                                                {#each fields as field}
                                                    {@const config = getFieldConfig(field)}
                                                    {@const fieldLabel = config.label ?? config.name}
                                                    {@const fieldValue = getFieldValue(section.type, config.name)}

                                                    {#if config.type === "dynamicgroup"}
                                                        <div class="sm:col-span-2">
                                                            <div class="mb-2 flex items-center gap-2">
                                                                <div class="text-xs font-semibold uppercase tracking-widest text-(--grey)">{fieldLabel}</div>
                                                                {#if Array.isArray(fieldValue) && config.checkable}
                                                                    {@const doneCount = fieldValue.filter((item: any) => item?.done).length}
                                                                    <span class="rounded-full bg-(--light-bg3) px-2 py-px text-xs font-medium text-(--grey)">
                                                                        {doneCount}/{fieldValue.length}
                                                                    </span>
                                                                {/if}
                                                            </div>

                                                            {#if Array.isArray(fieldValue) && fieldValue.length}
                                                                <div class="flex flex-col gap-2">
                                                                    {#each fieldValue as entry, idx}
                                                                        {@const subFields = config.fields ?? []}
                                                                        {@const isDone = entry?.done === true}
                                                                        {@const key = groupKey(section.type, config.name, idx)}
                                                                        <div class="rounded-lg border border-(--light-bg3) p-3 transition-colors {isDone ? 'bg-(--light-bg2)' : 'bg-(--light-bg1)'}">
                                                                            <div class="flex items-center gap-2">
                                                                                {#if config.checkable && canEditSection(section)}
                                                                                    <Checkbox
                                                                                        value={isDone}
                                                                                        on:change={() => toggleCheckableItem(section.type, config.name, idx, !isDone)}
                                                                                    />
                                                                                {/if}
                                                                                <span class="min-w-0 flex-1 truncate text-sm font-medium {isDone ? 'text-(--grey) line-through' : ''}">
                                                                                    {config.itemLabel ?? "Élément"} {idx + 1}
                                                                                </span>
                                                                                {#if updatingGroups[key]}
                                                                                    <Icon.Loader2 size={13} class="ui-loader-spin text-(--grey)" />
                                                                                {/if}
                                                                            </div>

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
                                                        <div class={config.type === "textarea" || config.type === "text-area" ? "sm:col-span-2" : ""}>
                                                            <div class="mb-1 text-xs font-semibold uppercase tracking-widest text-(--grey)">{fieldLabel}</div>
                                                            <div class="break-words text-sm leading-relaxed">
                                                                {#if isPasswordField(config)}
                                                                    <span class="font-mono font-semibold">{formatDisplayedFieldValue(fieldValue, config)}</span>
                                                                {:else}
                                                                    <DisplayValue value={fieldValue} display={config.displayValue ?? config.operationDisplay} />
                                                                {/if}
                                                            </div>
                                                        </div>
                                                    {/if}
                                                {/each}
                                            </div>
                                            {#if canEditSection(section)}
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
                            <div class="text-sm text-(--grey)">Aucun formulaire associé à cette {operationSingularLower($appSettings.value.operation)}.</div>
                        </div>
                    {/if}
                </section>
            </div>

            <CollapsibleSidebar id="operation-right-panel" side="right" width="420px" collapsedWidth="64px">
                {#snippet children({ collapsed, onToggle })}
                    <Tabs.Root value={activePanel} onValueChange={changePanel} class="flex h-full min-w-0">
                        <Tabs.List class="flex w-16 shrink-0 flex-col gap-1 px-2 py-3 {collapsed ? '' : 'border-r border-(--light-bg3)'}">
                            {#if operationActivityEnabled()}
                            <Tabs.Trigger
                                value="activity"
                                title="Activité"
                                onclick={() => revealRightSidebar(collapsed, onToggle)}
                                class="nav-button flex size-10 cursor-pointer items-center justify-center rounded-lg text-(--grey) transition-colors hover:text-(--dark-bg1) {activePanel === 'activity' ? '--active text-(--dark-bg1)!' : ''}"
                            >
                                <Icon.Activity size={17} />
                            </Tabs.Trigger>
                            {/if}
                            {#if operationNotesVisible()}
                                <Tabs.Trigger
                                    value="notes"
                                    title="Notes"
                                    onclick={() => revealRightSidebar(collapsed, onToggle)}
                                    class="nav-button flex size-10 cursor-pointer items-center justify-center rounded-lg text-(--grey) transition-colors hover:text-(--dark-bg1) {activePanel === 'notes' ? '--active text-(--dark-bg1)!' : ''}"
                                >
                                    <Icon.MessageSquare size={17} />
                                </Tabs.Trigger>
                            {/if}
                            <Tabs.Trigger
                                value="documents"
                                title="Documents"
                                onclick={() => revealRightSidebar(collapsed, onToggle)}
                                class="nav-button flex size-10 cursor-pointer items-center justify-center rounded-lg text-(--grey) transition-colors hover:text-(--dark-bg1) {activePanel === 'documents' ? '--active text-(--dark-bg1)!' : ''}"
                            >
                                <Icon.Files size={17} />
                            </Tabs.Trigger>
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
                                    <div class="text-sm font-semibold text-(--dark-bg1)">{activePanel === "documents" ? "Documents" : PANEL_META[activePanel]?.title}</div>
                                    <div class="mt-0.5 text-xs font-normal leading-4 text-(--grey)">
                                        {activePanel === "documents" ? "Reçus et empreintes liés à cette opération" : panelSubtitle(activePanel)}
                                    </div>
                                </div>

                                <div class="min-h-0 flex-1">
                                    {#if operationActivityEnabled()}
                                    <Tabs.Content value="activity" class="h-full">
                                        <OperationActivity
                                            bind:this={activityPanel}
                                            operationId={operation.id}
                                            states={orderedStates}
                                            privacy={activityPrivacy}
                                            privacyReady={activityPrivacyReady}
                                            onLoaded={(loaded: any[]) => (activities = loaded)}
                                        />
                                    </Tabs.Content>
                                    {/if}

                                    {#if operationNotesVisible()}
                                        <Tabs.Content value="notes" class="h-full">
                                            <OperationNotes
                                                operationId={operation.id}
                                                active={activePanel === "notes"}
                                                markdownEnabled={$appSettings.value.operation.notesMarkdownEnabled}
                                                trackingEnabled={operationTracking?.enabled === true}
                                                onCountChange={(count) => (noteCount = count)}
                                                onChanged={() => { void activityPanel?.refresh?.(); void trackingPanel?.refresh?.(); }}
                                            />
                                        </Tabs.Content>
                                    {/if}

                                    <Tabs.Content value="documents" class="h-full">
                                        <OperationDocuments bind:this={documentsPanel} {operation} canCreate={can("documents.create")} />
                                    </Tabs.Content>

                                    <Tabs.Content value="about" class="h-full">
                                        <OperationAbout
                                            {operation}
                                            pagesData={accordionSections}
                                            states={orderedStates}
                                            {activities}
                                            {noteCount}
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
