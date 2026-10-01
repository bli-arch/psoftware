<script lang="ts">
    import { Dialog } from "bits-ui";
    import { draw, fade } from "svelte/transition";
    import { backInOut } from "svelte/easing";
    import { toast } from "svelte-sonner";
    import MyDialog from "$lib/components/MyDialog.svelte";
    import { Button, TextInput } from "$lib/components/istyler";
    import { apiDelete, apiGet, apiPatch, apiPost } from "$lib/api";
    import { animationTime } from "$lib/uiPreferences";
    import { normalizeFormList } from "$lib/formConfig";
    import { currentPage, markPagesSaved, markPagesUnsaved, pages, pagesSaved } from "./stores";
    import FormBuilder from "./FormBuilder.svelte";
    import Toolbar from "./Toolbar.svelte";
    import CreateFormModal from "./CreateFormModal.svelte";
    import FormTemplateCard from "./FormTemplateCard.svelte";
    import FormBuilderDetailsSidebar from "./FormBuilderDetailsSidebar.svelte";
    import { denormalizeFormPages } from "./normalization";
    import type { FormFilter, ManagedForm, ManagedFormType, NewPageTemplate } from "./formManagerTypes";
    import { getFormName, getFormPages } from "./formManagerTypes";
    import { serializeBuilderItem } from "./builderFieldUtils";
    import * as Icon from "lucide-svelte";

    let {
        formType = "operation",
        triggerLabel = "Ouvrir le créateur de formulaire",
        title = "Créateur de formulaire",
        description = "Gérez les formulaires disponibles.",
        defaultPageTitles = ["Appareil", "Devis"],
        fallbackPageTitle = "Informations générales",
        fallbackPageDescription = "Informations principales.",
        newFormNamePlaceholder = "ex. Formulaire principal",
        searchPlaceholder = "Rechercher un formulaire...",
        directCreate = false,
        newFormName = "",
        newFormSettings = {},
        closeOnSave = false,
        onSaved = () => {}
    }: {
        formType?: ManagedFormType;
        triggerLabel?: string;
        title?: string;
        description?: string;
        defaultPageTitles?: string[];
        fallbackPageTitle?: string;
        fallbackPageDescription?: string;
        newFormNamePlaceholder?: string;
        searchPlaceholder?: string;
        directCreate?: boolean;
        newFormName?: string;
        newFormSettings?: Record<string, unknown>;
        closeOnSave?: boolean;
        onSaved?: (form: ManagedForm) => void;
    } = $props();

    let dialogOpen = $state(false);
    let showIntro: boolean = $state(true);
    let showFormList: boolean = $state(false);
    let showFormBuilder: boolean = $state(false);
    let introAnimationFired: boolean = false;

    let forms: ManagedForm[] = $state([]);
    let editingFormId: number | null = $state(null);
    let editingFormName: string = $state("");
    let editingFormSettings: Record<string, unknown> = $state({});
    let editingFormActive: number | boolean | undefined = $state(undefined);
    let savedFormName: string | null = $state(null);
    let builderSaving = $state(false);

    let searchTerm = $state("");
    let filterType = $state<FormFilter>("all");

    function initialPageTitles() {
        return [...defaultPageTitles];
    }

    let showCreateModal = $state(false);
    let modalFormName = $state("");
    let modalPageTitles = $state(initialPageTitles());

    const filteredForms = $derived.by(() => {
        let result = forms;

        if (filterType === "active") result = forms.filter((form) => Boolean(form.is_active));
        else if (filterType === "draft") result = forms.filter((form) => !form.is_active);

        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            result = result.filter((form) =>
                getFormName(form).toLowerCase().includes(term) ||
                getFormPages(form).some((page) => (page.title ?? "").toLowerCase().includes(term))
            );
        }

        return result;
    });

    const builderSaved = $derived($pagesSaved && savedFormName !== null && editingFormName.trim() === savedFormName);

    function playIntro(svgDuration: number = 2000) {
        introAnimationFired = true;
        setTimeout(async () => {
            showIntro = false;
            await loadForms();
            showFormList = true;
        }, animationTime(svgDuration));
    }

    async function loadForms() {
        try {
            forms = normalizeFormList(await apiGet(`/settings/form/?type=${formType}`)) as ManagedForm[];
        } catch (error) {
            console.error("Failed to load forms", error);
        }
    }

    function selectForm(form: ManagedForm) {
        const formPages = getFormPages(form);
        const nextPages = denormalizeFormPages(formPages);
        pages.set(nextPages);
        markPagesSaved(nextPages);
        currentPage.set(0);
        editingFormId = form.id;
        editingFormActive = form.is_active;
        editingFormName = getFormName(form);
        editingFormSettings = { ...(form.settings ?? {}) };
        savedFormName = editingFormName.trim();
        showFormList = false;
        showFormBuilder = true;
    }

    function buildNewPages(): NewPageTemplate[] {
        const newPages = modalPageTitles
            .filter((pageTitle) => pageTitle.trim())
            .map((title) => ({
                title,
                description: "",
                icon: "ClipboardList",
                type: "data" as const,
                items: []
            }));

        return newPages.length
            ? newPages
            : [{ title: fallbackPageTitle, description: fallbackPageDescription, icon: "ClipboardList", type: "data", items: [] }];
    }

    function newForm() {
        pages.set(buildNewPages());
        markPagesUnsaved();
        currentPage.set(0);
        editingFormId = null;
        editingFormActive = 0;
        editingFormName = modalFormName.trim();
        editingFormSettings = { ...newFormSettings };
        savedFormName = null;
        showFormList = false;
        showFormBuilder = true;
        showCreateModal = false;
    }

    function openManager() {
        if (!directCreate) {
            if (!introAnimationFired) playIntro();
            return;
        }

        showIntro = false;
        modalFormName = newFormName;
        modalPageTitles = [...defaultPageTitles];
        newForm();
        editingFormActive = true;
    }

    async function activateForm(form: ManagedForm, event: MouseEvent) {
        event.stopPropagation();
        try {
            const saved = await apiPatch(`/settings/form/${form.id}/`, { is_active: true });
            await loadForms();
            onSaved(saved);
        } catch (error) {
            console.error("Failed to activate form", error);
        }
    }

    async function deleteForm(form: ManagedForm, event: MouseEvent) {
        event.stopPropagation();
        if (form.is_active) return;
        try {
            await apiDelete(`/settings/form/${form.id}/`);
            await loadForms();
        } catch (error) {
            console.error("Failed to delete form", error);
        }
    }

    function openCreateModal() {
        modalFormName = "";
        modalPageTitles = [...defaultPageTitles];
        showCreateModal = true;
    }

    async function backToList() {
        await loadForms();
        showFormBuilder = false;
        showFormList = true;
    }

    function markBuilderSaved(form: ManagedForm) {
        editingFormId = form.id;
        editingFormActive = form.is_active;
        editingFormSettings = { ...(form.settings ?? {}) };
        savedFormName = editingFormName.trim();
        onSaved(form);
        if (closeOnSave) dialogOpen = false;
    }

    async function saveBuilder(): Promise<boolean> {
        if (builderSaving) return false;
        builderSaving = true;

        const form = {
            uuid: crypto.randomUUID(),
            pages: $pages.map(({ title, description, icon, iconColor, type, items }) => ({
                title,
                description,
                icon,
                iconColor,
                type,
                items: items.map((item) => serializeBuilderItem(item))
            }))
        };
        const settings = { ...editingFormSettings };
        const cleanFormName = editingFormName.trim();
        if (cleanFormName) settings.name = cleanFormName;
        else delete settings.name;

        try {
            const savedForm: ManagedForm = editingFormId
                ? await apiPatch(`/settings/form/${editingFormId}/`, { form, settings })
                : await apiPost("/settings/form/", {
                    form,
                    type: formType,
                    settings,
                    ...(editingFormActive ? { is_active: 1 } : {})
                });

            markPagesSaved($pages);
            markBuilderSaved(savedForm);
            toast.success(`Formulaire à ${$pages.length} page${$pages.length > 1 ? "s" : ""} enregistré`);
            return true;
        } catch (error) {
            console.error("Failed to save form", error);
            toast.error("Impossible d'enregistrer le formulaire");
            return false;
        } finally {
            builderSaving = false;
        }
    }

    async function saveBuilderAndBack() {
        if (await saveBuilder()) await backToList();
    }

</script>

<Dialog.Root bind:open={dialogOpen}>
    <Dialog.Trigger tabindex={-1}>
        {#snippet child({ props })}
            <Button
                {...props}
                label={triggerLabel}
                icon="SquareScissors"
                onclick={(event) => {
                    props.onclick?.(event);
                    openManager();
                }}
            />
        {/snippet}
    </Dialog.Trigger>
    <Dialog.Portal>
        <MyDialog class="w-full h-full flex flex-col max-h-none max-w-none rounded-none p-0!
            bg-(--light-bg1) text-(--dark-bg1) box-border fixed -translate-x-1/2 -translate-y-1/2
            shadow-2xl left-1/2 top-1/2">

            {#if showIntro}
                <div
                    class="flex items-center h-full w-full justify-center absolute top-0 left-0"
                    out:fade|global={{ duration: animationTime(300) }}
                >
                    <svg width="150" height="150" viewBox="0 0 396 418" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                            in:draw|global={{ duration: animationTime(1500), easing: backInOut }}
                            d="M87.9909 308.005V110.005C87.9909 110.005 87.2249 75.2262 112 50.0033C139.504 22.0023 170.492 22 170.492 22H219.992"
                            stroke="var(--astaji-color)" stroke-width="44"
                        />
                        <rect
                            in:draw|global={{ duration: animationTime(1500), easing: backInOut, delay: animationTime() }}
                            x="198" y="220.004" width="176" height="176" rx="88"
                            stroke="var(--astaji-color)" stroke-width="44"
                        />
                        <path
                            in:draw|global={{ duration: animationTime(1500), easing: backInOut, delay: animationTime(400) }}
                            d="M198 418V176H0"
                            stroke="var(--astaji-color)" stroke-linejoin="bevel" stroke-width="44"
                        />
                    </svg>
                </div>
            {/if}

            {#if showFormList}
                <div class="w-full h-full flex flex-col overflow-hidden" in:fade={{ duration: animationTime(300) }}>
                    <div class="flex h-14 shrink-0 items-center justify-between border-b border-(--light-bg3) bg-(--light-bg1) px-6">
                        <div>
                            <div class="text-lg font-extrabold font-(family-name:--font)">{title}</div>
                            <div class="text-sm text-(--grey) font-(family-name:--font)">{description}</div>
                        </div>
                        <Dialog.Close>
                            {#snippet child({ props })}
                                <Button {...props} variant="ghost" icon="X" class="px-2 bg-transparent hover:bg-(--light-bg3) text-(--dark-bg1)" />
                            {/snippet}
                        </Dialog.Close>
                    </div>

                    <div class="flex items-center gap-4 px-6 py-3 bg-(--light-bg1) shrink-0">
                        <div class="flex w-xs">
                            <TextInput
                                placeholder={searchPlaceholder}
                                name="formbuilder-search"
                                icon="Search"
                                iconSide="left"
                                bind:value={searchTerm}
                            />
                        </div>

                        <div class="flex gap-1">
                            {#each [["all", "Tous"], ["active", "Actif"], ["draft", "Brouillons"]] as [type, label]}
                                <Button
                                    variant={filterType === type ? 'primary' : 'secondary'}
                                    size="sm"
                                    onclick={() => filterType = type as FormFilter}
                                    class="w-fit focus:ring-0"
                                >
                                    {type == "all" ? `${label} (${forms.length})` : label}
                                </Button>
                            {/each}
                        </div>
                    </div>

                    <div class="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
                        <div class="-mb-2 font-(family-name:--font) text-xs font-semibold uppercase tracking-wider text-(--grey)">
                            Tous les formulaires
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            <Button
                                variant="ghost"
                                onclick={openCreateModal}
                                class="group relative overflow-hidden border-2 border-dashed border-(--light-bg3) rounded-xl min-h-36 h-full flex flex-col items-center justify-center gap-2 cursor-pointer bg-white/50 transition-all duration-(--animation-duration-300)
                                    hover:border-(--user-color) hover:bg-(--user-color-transparent) hover:-translate-y-1 hover:shadow-(--shadow-popover)
                                    active:translate-y-0 active:scale-100
                                    focus-visible:border-(--user-color) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--user-color-transparent)
                                    before:pointer-events-none before:absolute before:inset-0 before:rounded-xl before:opacity-0 before:transition-opacity before:duration-(--animation-duration-300) before:bg-(--user-color-transparent)
                                    hover:before:opacity-100"
                            >
                                <span class="relative z-10 w-11 h-11 rounded-xl bg-white border border-(--light-bg3) flex items-center justify-center text-2xl font-light text-(--grey) transition-all duration-(--animation-duration-300)
                                        group-hover:border-(--user-color) group-hover:text-(--user-color)">
                                    <Icon.Plus size="12" class="group-hover:rotate-90 transition-all duration-(--animation-duration-300)"/>
                                    
                                </span>

                                <span class="relative z-10 text-sm font-medium text-(--grey) transition-colors duration-(--animation-duration) group-hover:text-(--user-color) font-(family-name:--font)">
                                    Nouveau formulaire
                                </span>

                                <span class="relative z-10 text-xs text-(--grey) opacity-0 translate-y-1 transition-all duration-(--animation-duration-300) delay-(--animation-delay-75)
                                    group-hover:opacity-70 group-hover:translate-y-0 font-(family-name:--font)">
                                    Créer un nouveau formulaire
                                </span>
                            </Button>

                            {#each filteredForms as form (form.id)}
                                <FormTemplateCard
                                    {form}
                                    onSelect={selectForm}
                                    onActivate={activateForm}
                                    onDelete={deleteForm}
                                />
                            {/each}
                        </div>
                    </div>
                </div>
            {/if}

            {#if showFormBuilder}
                <div in:fade={{ duration: animationTime(300) }} class="flex min-h-0 flex-1 overflow-hidden">
                    <FormBuilderDetailsSidebar
                        bind:formName={editingFormName}
                        saved={builderSaved}
                        onBack={backToList}
                        onSaveAndBack={saveBuilderAndBack}
                    />
                    <div class="min-w-0 flex-1 h-full">
                        <FormBuilder {formType} />
                    </div>
                    <Toolbar saving={builderSaving} onSave={saveBuilder} />
                </div>
            {/if}

            <CreateFormModal
                bind:open={showCreateModal}
                bind:formName={modalFormName}
                bind:pageTitles={modalPageTitles}
                namePlaceholder={newFormNamePlaceholder}
                onCreate={newForm}
            />
        </MyDialog>
    </Dialog.Portal>
</Dialog.Root>
