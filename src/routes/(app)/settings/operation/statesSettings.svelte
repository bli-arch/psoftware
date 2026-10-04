<script lang="ts">
    import * as Icon from "lucide-svelte";
    import { onMount, untrack } from "svelte";
    import { toast } from "svelte-sonner";
    import { apiDelete, apiGet, apiPatch, apiPost } from "$lib/api";
    import { Button, IconPicker, TextInput } from "$lib/components/istyler";
    import DisplayValue from "$lib/components/table/DisplayValue.svelte";
    import SettingsDrilldownList, { type SettingsDrilldownItem } from "$lib/components/settings/SettingsDrilldownList.svelte";

    type StateSettings = {
        uuid: string;
        id?: number;
        name: string;
        step: number;
        settings: {
            color?: string;
            icon?: string;
        };
    };

    let {
        unsavedChanges = $bindable(false),
        initialStates = null,
        onSaved = () => {},
    }: {
        unsavedChanges?: boolean;
        initialStates?: any[] | null;
        onSaved?: () => void | Promise<void>;
    } = $props();

    let selectedStateId = $state<string | number | null>(null);
    let currentState = $state<StateSettings | null>(null);
    let states = $state<StateSettings[]>([]);
    let removedStateIds = $state<number[]>([]);
    let loaded = $state(false);
    let loadingPromise: Promise<void> | null = null;
    let savedSettingsKey = $state("");
    let isSaving = $state(false);
    let editingStateKey: string | null = null;
    let editSnapshot = $state<StateSettings | null>(null);

    const colorOptions = [
        { value: "", label: "Aucune", textClass: "text-(--grey)", bgClass: "bg-(--light-bg2)", swatchClass: "border border-(--light-bg3) bg-transparent" },
        { value: "blue", label: "Bleu", textClass: "text-(--blue)", bgClass: "bg-(--blue)/10", swatchClass: "bg-(--blue)" },
        { value: "green", label: "Vert", textClass: "text-(--green)", bgClass: "bg-(--green)/10", swatchClass: "bg-(--green)" },
        { value: "orange", label: "Orange", textClass: "text-(--orange)", bgClass: "bg-(--orange)/10", swatchClass: "bg-(--orange)" },
        { value: "red", label: "Rouge", textClass: "text-(--red)", bgClass: "bg-(--red)/10", swatchClass: "bg-(--red)" },
        { value: "grey", label: "Gris", textClass: "text-(--grey)", bgClass: "bg-(--grey)/10", swatchClass: "bg-(--grey)" },
    ];

    const stateItems = $derived(states.map((state) => ({
        id: state.uuid ?? state.id,
        title: state.name || `Statut ${state.step}`,
        description: `Position ${state.step}`,
        icon: state.settings.icon || "Circle",
        color: state.settings.color || "--page-icon-slate",
    }) satisfies SettingsDrilldownItem));

    const previewStates = $derived(currentState ? [{ ...currentState, id: currentState.id ?? currentState.uuid }] : []);
    const currentHasChanges = $derived(Boolean(
        currentState
        && editSnapshot
        && (!currentState.id || JSON.stringify(currentState) !== JSON.stringify(editSnapshot))
    ));

    function normalizeSettings(settings: Partial<StateSettings["settings"]> = {}) {
        const color = settings.color?.trim();
        const icon = settings.icon?.trim();

        return {
            ...(color ? { color } : {}),
            ...(icon ? { icon } : {}),
        };
    }

    function stateKey(list: StateSettings[]) {
        return JSON.stringify(list.map((state, index) => ({
            id: state.id,
            name: state.name,
            step: index + 1,
            settings: normalizeSettings(state.settings),
        })));
    }

    function cloneState(state: StateSettings) {
        return structuredClone($state.snapshot(state)) as StateSettings;
    }

    function withStepOrder(list: StateSettings[]) {
        return list.map((state, index) => ({ ...state, step: index + 1 }));
    }

    function updateUnsavedState() {
        unsavedChanges = loaded && (stateKey(states) !== savedSettingsKey || removedStateIds.length > 0);
    }

    function stateById(id: string | number | null) {
        return states.find((state) => state.uuid === id || state.id === id) ?? null;
    }

    function prepareStates(results: any[]) {
        return withStepOrder(
            results
                .map((item) => ({
                    uuid: crypto.randomUUID(),
                    id: item.id,
                    name: item.name ?? "",
                    step: item.step ?? 0,
                    settings: normalizeSettings({
                        color: item.settings?.color,
                        icon: item.settings?.icon,
                    }),
                }))
                .sort((a, b) => (a.step ?? 0) - (b.step ?? 0) || (a.id ?? 0) - (b.id ?? 0))
        );
    }

    async function getStates() {
        try {
            const data = await apiGet("/settings/state/");
            applyStatesData(data?.results ?? data ?? []);
        } catch (error) {
            if ((error as { status?: number })?.status !== 404) {
                console.error("Failed to load states:", error);
                toast.error("Impossible de charger les statuts");
            }
            loaded = true;
        }
    }

    function applyStatesData(data: any[]) {
        const prepared = prepareStates(data);

        states = prepared;
        removedStateIds = [];
        savedSettingsKey = stateKey(prepared);
        unsavedChanges = false;
        loaded = true;
    }

    function loadStates() {
        loadingPromise ??= getStates();
        return loadingPromise;
    }

    export async function addState() {
        if (!loaded) await loadStates();

        const newState: StateSettings = {
            uuid: crypto.randomUUID(),
            name: `Statut ${states.length + 1}`,
            step: states.length + 1,
            settings: {
                color: "blue",
                icon: "Circle",
            },
        };

        states = withStepOrder([...states, newState]);
        selectedStateId = newState.uuid;
        updateUnsavedState();
    }

    function removeState(state: StateSettings) {
        states = withStepOrder(states.filter((item) => item.uuid !== state.uuid));

        if (state.id && !removedStateIds.includes(state.id)) {
            removedStateIds = [...removedStateIds, state.id];
        }

        if (selectedStateId === state.uuid || selectedStateId === state.id) {
            selectedStateId = null;
        }

        updateUnsavedState();
    }

    function discardCurrentState() {
        if (!currentState || !editSnapshot) return;
        const snapshot = editSnapshot;

        if (!currentState.id) {
            states = withStepOrder(states.filter((state) => state.uuid !== currentState?.uuid));
        } else {
            states = states.map((state) =>
                state.uuid === currentState?.uuid ? cloneState(snapshot) : state
            );
        }

        currentState = null;
        editSnapshot = null;
        editingStateKey = null;
        updateUnsavedState();
    }

    function commitCurrent() {
        if (!currentState) return;

        states = states.map((item) =>
            item.uuid === currentState?.uuid
                ? { ...item, name: currentState.name, settings: normalizeSettings(currentState.settings) }
                : item
        );
        currentState = { ...currentState, settings: normalizeSettings(currentState.settings) };
        updateUnsavedState();
    }

    function updateCurrentIcon(icon: string) {
        if (!currentState) return;

        currentState.settings.icon = icon;
        commitCurrent();
    }

    function updateCurrentColor(color: string) {
        if (!currentState) return;

        currentState.settings.color = color;
        commitCurrent();
    }

    function buildPayload(state: StateSettings) {
        return {
            name: state.name?.trim() || `Statut ${state.step}`,
            step: state.step,
            settings: normalizeSettings(state.settings),
        };
    }

    export async function saveStates() {
        if (isSaving) return;

        if (!states.length) {
            toast.error("Ajoutez au moins un statut");
            return;
        }

        if (states.some((state) => !state.name?.trim())) {
            toast.error("Chaque statut doit avoir un nom");
            return;
        }

        isSaving = true;
        const orderedStates = withStepOrder(states);
        states = orderedStates;

        try {
            const snapshots = $state.snapshot(orderedStates) as StateSettings[];
            const creations = snapshots.filter((state) => !state.id);
            const updates = snapshots.filter((state) => state.id);

            await Promise.all([
                ...creations.map((state) => apiPost("/settings/state/", buildPayload(state))),
                ...updates.map((state) => apiPatch(`/settings/state/${state.id}/`, buildPayload(state))),
                ...removedStateIds.map((id) => apiDelete(`/settings/state/${id}/`)),
            ]);

            toast.success("Statuts enregistrés");
            await getStates();
            void onSaved();
        } catch (error) {
            console.error("Error saving states:", error);
            toast.error("Erreur lors de la sauvegarde");
        } finally {
            isSaving = false;
        }
    }

    function reorderStates(oldIndex: number, newIndex: number, orderedIds: string[] = []) {
        const statesByKey = new Map(states.map((state) => [String(state.uuid ?? state.id), state]));
        const orderedStates = orderedIds.map((id) => statesByKey.get(id)).filter(Boolean) as StateSettings[];

        if (orderedStates.length === states.length) {
            states = withStepOrder(orderedStates);
        } else {
            const nextStates = [...states];
            const [movedState] = nextStates.splice(oldIndex, 1);
            nextStates.splice(newIndex, 0, movedState);
            states = withStepOrder(nextStates);
        }

        if (currentState) {
            currentState = states.find((state) => state.uuid === currentState?.uuid) ?? null;
        }

        updateUnsavedState();
    }

    $effect(() => {
        const nextState = stateById(selectedStateId);
        const nextKey = nextState ? String(nextState.uuid ?? nextState.id) : null;

        if (nextKey !== editingStateKey) {
            editingStateKey = nextKey;
            editSnapshot = nextState ? cloneState(nextState) : null;
        }

        currentState = nextState;
        if (selectedStateId !== null && !nextState) selectedStateId = null;
    });

    const initialData = untrack(() => initialStates);
    if (initialData !== null) applyStatesData(initialData);

    $effect.pre(() => {
        if (initialStates === null || loaded) return;
        applyStatesData(initialStates);
    });

    onMount(() => {
        if (!loaded && initialStates === null) void loadStates();
    });

</script>

<div class="flex flex-col gap-3">
    {#if !loaded}
        <div class="flex items-center justify-center gap-2 px-4 py-5 text-center text-xs font-medium text-(--grey)">
            <Icon.LoaderCircle size={14} class="ui-loader-spin" />
            Chargement des statuts...
        </div>
    {:else}
        <SettingsDrilldownList
            items={stateItems}
            bind:selectedId={selectedStateId}
            onReorder={reorderStates}
            emptyTitle="Aucun statut configuré"
            emptyDescription="Ajoutez un statut pour configurer le workflow."
            backLabel="Tous les statuts"
            backConfirm={currentHasChanges}
            backConfirmTitle="Quitter sans enregistrer ?"
            backConfirmDescription="Les modifications de ce statut seront abandonnées."
            backConfirmCancelLabel="Rester"
            backConfirmConfirmLabel="Quitter"
            onBack={discardCurrentState}
        >
            {#snippet itemLeft()}
                <span
                    class="grabber flex size-6 shrink-0 cursor-grab items-center justify-center rounded-md text-(--grey) hover:bg-(--light-bg2) active:cursor-grabbing"
                    aria-label="Déplacer le statut"
                    role="presentation"
                >
                    <Icon.GripVertical size={15} />
                </span>
            {/snippet}

            {#snippet itemRight(item)}
                {@const state = stateById(item.id)}
                {#if state}
                    <Button
                        variant="ghost"
                        size="sm"
                        icon="Trash2"
                        tooltip="Supprimer le statut"
                        class="size-8 w-8 shrink-0 border border-(--light-bg3) px-0 text-(--red) hover:bg-(--transparent-red)"
                        aria-label="Supprimer le statut"
                        confirm
                        confirmTitle="Supprimer ce statut ?"
                        confirmDescription="Le statut sera retiré de la liste."
                        confirmCancelLabel="Annuler"
                        confirmConfirmLabel="Supprimer"
                        confirmConfirmVariant="error"
                        onclick={() => removeState(state)}
                    />
                {/if}
            {/snippet}

            {#snippet listFooter()}
                <Button
                    variant="ghost"
                    size="md"
                    class="group/create-card h-auto w-full flex-center gap-3 rounded-none border-t border-(--light-bg3) px-4 py-3 text-left text-(--dark-bg1) hover:bg-(--user-color)/5 hover:text-(--user-color)"
                    onclick={addState}
                >
                    <Icon.Plus size="16" />
                    <span class="min-w-0">
                        <span class="block truncate text-xs font-semibold">Ajouter un statut</span>
                    </span>
                </Button>
            {/snippet}

            {#snippet detail()}
                {#if currentState}
                    <div class="grid gap-4 px-4 pb-4 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.6fr)]">
                        <aside class="flex min-h-64 flex-col overflow-hidden rounded-lg border border-(--light-bg3) bg-(--light-bg2) p-4">
                            <div class="text-xs font-semibold uppercase tracking-widest text-(--grey)">Aperçu</div>
                            <div class="flex min-h-0 flex-1 items-center justify-center">
                                <DisplayValue
                                    value={currentState.id ?? currentState.uuid}
                                    display="state"
                                    states={previewStates}
                                    class="max-w-52"
                                />
                            </div>
                        </aside>

                        <div class="grid content-start gap-4">
                            <section class="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)]">
                                <IconPicker
                                    label="Icône et couleur"
                                    value={currentState.settings.icon ?? ""}
                                    fallback="Circle"
                                    allowDeselect
                                    showColors
                                    toneBackground
                                    color={currentState.settings.color ?? ""}
                                    fallbackColor=""
                                    colors={colorOptions}
                                    onSelect={updateCurrentIcon}
                                    onColorSelect={updateCurrentColor}
                                />

                                <TextInput
                                    name="name"
                                    label="Titre du statut"
                                    bind:value={currentState.name}
                                    required
                                    icon="Route"
                                    iconSide="left"
                                    oninput={commitCurrent}
                                />
                            </section>
                        </div>
                    </div>
                {/if}
            {/snippet}

            {#snippet actions(item)}
                {@const state = stateById(item?.id ?? null)}
                {#if state}
                    <Button
                        variant="error"
                        size="sm"
                        icon="Trash2"
                        label="Supprimer"
                        class="w-fit px-2.5 font-semibold"
                        confirm
                        confirmTitle="Supprimer ce statut ?"
                        confirmDescription="Le statut sera retiré de la liste."
                        confirmCancelLabel="Annuler"
                        confirmConfirmLabel="Supprimer"
                        confirmConfirmVariant="error"
                        onclick={() => removeState(state)}
                    />
                {/if}
                <Button
                    size="sm"
                    icon={isSaving ? "LoaderCircle" : "Save"}
                    iconAnimation={isSaving ? "spin" : undefined}
                    label={isSaving ? "Enregistrement..." : "Enregistrer"}
                    class="w-fit px-2.5 font-semibold"
                    disabled={!unsavedChanges || isSaving}
                    onclick={saveStates}
                />
            {/snippet}
        </SettingsDrilldownList>
    {/if}
</div>
