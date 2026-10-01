<script lang="ts">
    import * as Icon from "lucide-svelte";
    import { onMount, untrack } from "svelte";
    import { toast } from "svelte-sonner";
    import { apiGet, apiPatch } from "$lib/api";
    import {
        isRecord,
        normalizeFormConfig,
        normalizeTableSettings as normalizeStoredTableSettings,
        positiveInteger,
        recordList,
        recordOrEmpty,
    } from "$lib/formConfig";
    import { Button, Checkbox, IconPicker, Select, TextInput, validateDateFormat } from "$lib/components/istyler";
    import DateFormatInput from "$lib/components/istyler/DateFormatInput.svelte";
    import SettingsDrilldownList, { type SettingsDrilldownItem } from "$lib/components/settings/SettingsDrilldownList.svelte";
    import DisplayInput from "$lib/components/FormBuilder/DisplayInput.svelte";
    import DisplayValue from "$lib/components/table/DisplayValue.svelte";
    import { TABLE_CELL_DISPLAYS, type TableCellDisplay } from "$lib/components/table/tableDisplays";
    import { defaultDateDisplayFormat, displayOptionsByInputType } from "$lib/components/FormBuilder/fieldSchema";
    import type { InputType } from "$lib/components/istyler";

    type TableSetting = {
        uuid?: string;
        id: number;
        title: string;
        dataOrigin?: string;
        display?: TableCellDisplay;
        format?: string;
        setting?: Record<string, string | boolean | undefined>;
    };

    type FormLabelItem = {
        title: string;
        value: string;
        type?: InputType | string;
        mode?: string;
        format?: string;
        sampleValue?: unknown;
    };

    type FormLabelSection = {
        type: string;
        title: string;
        content: FormLabelItem[];
    };

    type FormType = "operation" | "client" | "product";

    let {
        formType = "operation",
        maxColumns = 10,
        showInlineAddButton = true,
        fieldPrefix = null,
        initialFormData = null,
        initialStates = null,
        unsavedChanges = $bindable(false),
        onSaved = () => {},
    }: {
        formType?: FormType;
        maxColumns?: number;
        showInlineAddButton?: boolean;
        fieldPrefix?: string | null;
        initialFormData?: any;
        initialStates?: any[] | null;
        unsavedChanges?: boolean;
        onSaved?: () => void | Promise<void>;
    } = $props();

    let selectedColumnId = $state<string | number | null>(null);
    let currentTableSetting = $state<TableSetting | null>(null);
    let tableSettings = $state<TableSetting[]>([]);
    let formLabels = $state<FormLabelSection[]>([]);
    let formId: number | null = $state(null);
    let formSettings = $state<Record<string, unknown>>({});
    let loaded = $state(false);
    let loadingPromise: Promise<void> | null = null;
    let savedSettingsKey = $state("");
    let isSaving = $state(false);
    let editingColumnKey: string | null = null;
    let editSnapshot = $state<TableSetting | null>(null);
    let editWasNew = $state(false);
    let savedColumnUuids = new Set<string>();

    const fallbackDisplayOptions = ["text", "identifier", "badge"] satisfies TableCellDisplay[];

    const columnItems = $derived(tableSettings.map((setting) => ({
        id: setting.uuid ?? setting.id,
        title: setting.title,
        description: TABLE_CELL_DISPLAYS[(setting.display ?? "text") as TableCellDisplay]?.label ?? setting.display ?? "Texte",
    }) satisfies SettingsDrilldownItem));
    const defaultDataOptions = $derived([
        { label: "Identifiant", value: "uid", type: "text", display: "identifier", sampleValue: "OP-2048-A" },
        ...(formType === "operation" ? [{ label: "Status", value: "state", type: "state", display: "state" }] : []),
        { label: "Créateur", value: "creator.username", type: "user", display: "user", sampleValue: { name: "Camille Martin" } },
        { label: "Date de création", value: "created_at", type: "date", display: "date", sampleValue: "2026-06-04" },
    ]);
    const fallbackPreviewStates = [
        { id: "preview-in-progress", name: "En cours", step: 1, settings: { color: "blue", icon: "LoaderCircle" } },
        { id: "preview-final-check", name: "Contrôle final", step: 2, settings: { color: "green", icon: "BadgeCheck" } },
    ];
    const previewStates = $derived.by(() => {
        const configured = recordList(initialStates)
            .filter((state) => (typeof state.id === "string" || typeof state.id === "number") && typeof state.name === "string" && state.name.trim())
            .sort((left, right) => Number(left.step ?? 0) - Number(right.step ?? 0))
            .slice(0, 2);

        return configured.length ? configured : fallbackPreviewStates;
    });
    const currentOriginInfo = $derived(originInfo(currentTableSetting?.dataOrigin));
    const currentDisplayOptions = $derived(displayOptionsForType(currentOriginInfo?.type));
    const currentDisplayConfig = $derived(TABLE_CELL_DISPLAYS[(currentTableSetting?.display ?? "text") as TableCellDisplay] ?? TABLE_CELL_DISPLAYS.text);
    const currentPreviewValue = $derived(
        currentTableSetting?.dataOrigin === "state"
            ? previewStates[0]?.id
            : currentOriginInfo?.sampleValue ?? currentDisplayConfig.sampleValue
    );
    const currentHasChanges = $derived(Boolean(
        currentTableSetting
        && editSnapshot
        && (editWasNew || JSON.stringify(currentTableSetting) !== JSON.stringify(editSnapshot))
    ));
    const previewTableRows = $derived([
        { id: "OP-2048", value: currentPreviewValue, state: previewStates[0]?.id },
        {
            id: "OP-2049",
            value: currentTableSetting?.dataOrigin === "state" || currentTableSetting?.display === "state"
                ? previewStates[1]?.id ?? previewStates[0]?.id
                : secondaryPreviewValue(currentTableSetting?.display, currentPreviewValue),
            state: previewStates[1]?.id ?? previewStates[0]?.id,
        },
    ]);

    function normalizeTableSettings(settings: unknown) {
        return (normalizeStoredTableSettings(settings) as TableSetting[]).map((setting, index) => ({
            ...setting,
            uuid: typeof setting.uuid === "string" && setting.uuid ? setting.uuid : crypto.randomUUID(),
            id: index + 1,
        }));
    }

    function pageItems(page: unknown) {
        const pageRecord = recordOrEmpty(page);
        return recordList(Array.isArray(pageRecord.items) ? pageRecord.items : pageRecord.formFields);
    }

    function fieldConfig(item: any) {
        if (isRecord(item?.config)) return item.config;
        if (isRecord(item?.props)) return item.props;
        return recordOrEmpty(item);
    }

    function fieldOrigin(section: FormLabelSection, item: FormLabelItem) {
        return `${fieldPrefix ?? section.type}.${item.value}`;
    }

    function defaultTableSettings(pages: unknown) {
        if (formType !== "client") return [];

        const fields = recordList(pages)
            .flatMap(pageItems)
            .map(fieldConfig)
            .filter((config: any) => typeof config?.name === "string" && Boolean(config.name.trim()))
            .slice(0, 3);

        return [
            { id: 1, title: "Identifiant", dataOrigin: "uid", display: "identifier" },
            ...fields.map((config: any, index: number) => ({
                id: index + 2,
                title: config.label ?? config.name,
                dataOrigin: `client.${config.name}`,
                display: (config.type === "date" ? "date" : "text") as TableCellDisplay,
                format: config.type === "date"
                    ? (typeof config.format === "string" && config.format
                        ? config.format
                        : defaultDateDisplayFormat(config.mode))
                    : undefined,
            })),
            { id: fields.length + 2, title: "Créé le", dataOrigin: "created_at", display: "date", format: "%d/%m/%Y" },
        ] satisfies TableSetting[];
    }

    function tableSettingsKey(settings: TableSetting[]) {
        return JSON.stringify(settings.map((setting, index) => ({
            ...setting,
            id: index + 1,
        })));
    }

    function cloneSetting(setting: TableSetting) {
        return structuredClone($state.snapshot(setting)) as TableSetting;
    }

    function updateUnsavedState() {
        unsavedChanges = loaded && tableSettingsKey(tableSettings) !== savedSettingsKey;
    }

    function displayOptionsForType(type: string | undefined) {
        if (type === "state") return ["state"] as TableCellDisplay[];
        if (type === "user") return ["user", "text", "identifier", "badge"] as TableCellDisplay[];
        const options = type && type in displayOptionsByInputType
            ? displayOptionsByInputType[type as InputType]
            : fallbackDisplayOptions;

        return (options ?? fallbackDisplayOptions) as TableCellDisplay[];
    }

    function originInfo(origin: string | undefined) {
        if (!origin) return null;

        const defaultOption = defaultDataOptions.find((option) => option.value === origin);
        if (defaultOption) return defaultOption;

        for (const section of formLabels) {
            const item = section.content.find((entry) => fieldOrigin(section, entry) === origin);
            if (item) return item;
        }

        return null;
    }

    function normalizeCurrentDisplay() {
        if (!currentTableSetting) return;

        const info = originInfo(currentTableSetting.dataOrigin);
        const options = displayOptionsForType(info?.type);
        if (!options.includes(currentTableSetting.display as TableCellDisplay)) {
            currentTableSetting.display = options[0] ?? "text";
        }

        if (currentTableSetting.display === "date" && !currentTableSetting.format) {
            currentTableSetting.format = info?.format || defaultDateDisplayFormat(info?.mode);
        }
    }

    function secondaryPreviewValue(display: TableCellDisplay | undefined, value: unknown) {
        if (Array.isArray(value)) return value.slice().reverse();
        if (typeof value === "number") return Math.max(0, Math.round(value * 0.72));
        if (typeof value === "boolean") return !value;
        if (value && typeof value === "object") return { name: "Jordan Petit" };
        if (display === "date" || display === "dueState" || display === "timeSince") return "2026-06-12";
        if (display === "email") return "atelier@exemple.fr";
        if (display === "phone") return "+33 1 45 67 89 10";
        if (display === "identifier") return "OP-2049-B";
        if (display === "badge") return "Standard";
        return "Contrôle final";
    }

    function applyFormData(data: unknown) {
        const config = normalizeFormConfig(data);
        const settings = config?.settings ?? {};
        const pages = config?.form.pages ?? [];
        const savedTableSettings = normalizeTableSettings(settings.tableSettings);

        formId = positiveInteger(config?.id ?? config?.form.id);
        formSettings = settings;
        tableSettings = savedTableSettings.length
            ? savedTableSettings
            : normalizeTableSettings(defaultTableSettings(pages));
        formLabels = pages.map((page) => ({
            type: page.type === "client" ? "client" : "data",
            title: typeof page.title === "string" ? page.title : "",
            content: pageItems(page).flatMap((item: any) => {
                const field = fieldConfig(item);
                const name = typeof field.name === "string" ? field.name.trim() : "";
                if (!name) return [];

                return [{
                    title: typeof field.label === "string" && field.label.trim() ? field.label : name,
                    value: name,
                    type: typeof field.type === "string" ? field.type : undefined,
                    mode: typeof field.mode === "string" ? field.mode : undefined,
                    format: typeof field.format === "string" ? field.format : undefined,
                    sampleValue: field.value,
                }];
            }),
        }));
        savedSettingsKey = tableSettingsKey(tableSettings);
        savedColumnUuids = new Set(tableSettings.flatMap((setting) => setting.uuid ? [setting.uuid] : []));
        unsavedChanges = false;
        loaded = true;
    }

    async function getTableSettings() {
        try {
            const data = await apiGet(`/settings/form/active/${formType}`);
            applyFormData(data);
        } catch (error) {
            if ((error as { status?: number })?.status !== 404) {
                console.error("Failed to load table settings:", error);
                toast.error("Erreur lors du chargement des colonnes");
            }
            loaded = true;
        }
    }

    function refreshCurrent() {
        if (!currentTableSetting) return;

        normalizeCurrentDisplay();
        tableSettings = tableSettings.map((item) =>
            item.uuid === currentTableSetting?.uuid ? { ...item, ...currentTableSetting } : item
        );
        currentTableSetting = { ...currentTableSetting };
    }

    function commitCurrent() {
        refreshCurrent();
        updateUnsavedState();
    }

    function handleCurrentDataOriginChange() {
        normalizeCurrentDisplay();
        if (currentTableSetting?.display === "date") {
            const info = originInfo(currentTableSetting.dataOrigin);
            currentTableSetting.format = info?.format || defaultDateDisplayFormat(info?.mode);
        }
        commitCurrent();
    }

    function updateCurrentSetting(key: string, value: string | boolean | undefined) {
        if (!currentTableSetting) return;

        currentTableSetting.setting ??= {};
        if (value === undefined || value === "") {
            delete currentTableSetting.setting[key];
        } else {
            currentTableSetting.setting[key] = value;
        }
        commitCurrent();
    }

    function settingById(id: string | number | null) {
        return tableSettings.find((setting) => setting.uuid === id || setting.id === id) ?? null;
    }

    export async function addColumn() {
        if (!loaded) await (loadingPromise ??= getTableSettings());

        if (tableSettings.length >= maxColumns) {
            toast.error(`Limite de colonnes atteinte (${maxColumns})`);
            return;
        }

        const newColumn: TableSetting = {
            uuid: crypto.randomUUID(),
            dataOrigin: "uid",
            display: "text",
            id: tableSettings.length + 1,
            title: `Colonne ${tableSettings.length + 1}`,
        };

        tableSettings = [...tableSettings, newColumn];
        currentTableSetting = newColumn;
        selectedColumnId = newColumn.uuid ?? newColumn.id;
        updateUnsavedState();
    }

    function removeColumn(setting: TableSetting) {
        tableSettings = tableSettings.filter((item) => item.uuid !== setting.uuid).map((item, index) => ({
            ...item,
            id: index + 1,
        }));

        if (currentTableSetting?.uuid === setting.uuid) {
            currentTableSetting = null;
            selectedColumnId = null;
        }

        updateUnsavedState();
    }

    function discardCurrentColumn() {
        if (!currentTableSetting || !editSnapshot) return;

        if (editWasNew) {
            tableSettings = tableSettings
                .filter((setting) => setting.uuid !== currentTableSetting?.uuid)
                .map((setting, index) => ({ ...setting, id: index + 1 }));
        } else {
            tableSettings = tableSettings.map((setting) =>
                setting.uuid === currentTableSetting?.uuid ? cloneSetting(editSnapshot) : setting
            );
        }

        currentTableSetting = null;
        editSnapshot = null;
        editWasNew = false;
        editingColumnKey = null;
        updateUnsavedState();
    }

    export async function saveColumns() {
        if (isSaving) return;

        if (!formId) {
            toast.error("Formulaire introuvable");
            return;
        }

        const invalidDateColumn = tableSettings.find((setting) =>
            setting.display === "date"
            && validateDateFormat(setting.format, { required: true, allowLiteralPercent: true })
        );
        if (invalidDateColumn) {
            selectedColumnId = invalidDateColumn.uuid ?? invalidDateColumn.id;
            toast.error(validateDateFormat(invalidDateColumn.format, {
                required: true,
                allowLiteralPercent: true,
            }) ?? "Format de date invalide");
            return;
        }

        const nextTableSettings = tableSettings.map((setting, index) => ({
            ...setting,
            id: index + 1,
        }));

        isSaving = true;

        try {
            formSettings = { ...formSettings, tableSettings: $state.snapshot(nextTableSettings) };
            await apiPatch(`/settings/form/${formId}/`, { settings: formSettings });
            tableSettings = nextTableSettings;
            savedSettingsKey = tableSettingsKey(nextTableSettings);
            savedColumnUuids = new Set(nextTableSettings.flatMap((setting) => setting.uuid ? [setting.uuid] : []));
            unsavedChanges = false;
            selectedColumnId = null;
            toast.success("Colonnes enregistrées");
            void onSaved();
        } catch (error) {
            console.error("Error saving columns:", error);
            toast.error("Erreur lors de la sauvegarde");
        } finally {
            isSaving = false;
        }
    }

    function reorderColumns(oldIndex: number, newIndex: number, orderedIds: string[] = []) {
        const settingsByKey = new Map(tableSettings.map((setting) => [String(setting.uuid ?? setting.id), setting]));
        const orderedSettings = orderedIds.map((id) => settingsByKey.get(id)).filter(Boolean) as TableSetting[];

        if (orderedSettings.length === tableSettings.length) {
            tableSettings = orderedSettings.map((setting, index) => ({ ...setting, id: index + 1 }));
        } else {
            const nextSettings = [...tableSettings];
            const [movedItem] = nextSettings.splice(oldIndex, 1);
            nextSettings.splice(newIndex, 0, movedItem);
            tableSettings = nextSettings.map((setting, index) => ({ ...setting, id: index + 1 }));
        }

        if (currentTableSetting) {
            currentTableSetting = tableSettings.find((setting) => setting.uuid === currentTableSetting?.uuid) ?? null;
        }

        updateUnsavedState();
    }

    const initialData = untrack(() => initialFormData);
    if (initialData) applyFormData(initialData);

    $effect.pre(() => {
        if (!initialFormData || loaded) return;
        applyFormData(initialFormData);
    });

    $effect(() => {
        const nextSetting = settingById(selectedColumnId);
        const nextKey = nextSetting ? String(nextSetting.uuid ?? nextSetting.id) : null;

        if (nextKey !== editingColumnKey) {
            editingColumnKey = nextKey;
            editSnapshot = nextSetting ? cloneSetting(nextSetting) : null;
            editWasNew = Boolean(nextSetting?.uuid && !savedColumnUuids.has(nextSetting.uuid));
        }

        currentTableSetting = nextSetting;
        if (selectedColumnId !== null && !nextSetting) selectedColumnId = null;
    });

    onMount(() => {
        if (!loaded && initialFormData === null) {
            loadingPromise = getTableSettings();
        }
    });
</script>

<div class="flex flex-col gap-3">
    {#if !loaded}
        <div class="flex items-center justify-center gap-2 px-4 py-5 text-center text-xs font-medium text-(--grey)">
            <Icon.LoaderCircle size={14} class="ui-loader-spin" />
            Chargement des colonnes...
        </div>
    {:else}
        <SettingsDrilldownList
            items={columnItems}
            bind:selectedId={selectedColumnId}
            onReorder={reorderColumns}
            emptyTitle="Aucune colonne configurée"
            emptyDescription={showInlineAddButton ? "Ajoutez une colonne pour configurer la table." : ""}
            backLabel="Toutes les colonnes"
            backConfirm={currentHasChanges}
            backConfirmTitle="Quitter sans enregistrer ?"
            backConfirmDescription="Les modifications de cette colonne seront abandonnées."
            backConfirmCancelLabel="Rester"
            backConfirmConfirmLabel="Quitter"
            onBack={discardCurrentColumn}
            showItemIcon={false}
        >
        {#snippet itemLeft()}
            <span
                class="grabber flex size-6 shrink-0 cursor-grab items-center justify-center rounded-md text-(--grey) hover:bg-(--light-bg2) active:cursor-grabbing"
                aria-label="Déplacer la colonne"
                role="presentation"
            >
                <Icon.GripVertical size={15} />
            </span>
        {/snippet}

        {#snippet itemRight(item)}
            {@const setting = settingById(item.id)}
            {#if setting}
                <Button
                    variant="ghost"
                    size="sm"
                    icon="Trash2"
                    tooltip="Supprimer la colonne"
                    class="size-8 w-8 shrink-0 border border-(--light-bg3) px-0 text-(--red) hover:bg-(--transparent-red)"
                    aria-label="Supprimer la colonne"
                    confirm
                    confirmTitle="Supprimer cette colonne ?"
                    confirmDescription="La colonne sera retirée de la liste."
                    confirmCancelLabel="Annuler"
                    confirmConfirmLabel="Supprimer"
                    confirmConfirmVariant="error"
                    onclick={() => removeColumn(setting)}
                />
            {/if}
        {/snippet}

        {#snippet listFooter()}
            {#if showInlineAddButton && tableSettings.length < maxColumns}
                <Button
                    variant="ghost"
                    size="md"
                    class="group/create-card h-auto w-full flex-center gap-3 rounded-none border-t border-(--light-bg3) px-4 py-3 text-left text-(--dark-bg1) hover:bg-(--user-color)/5 hover:text-(--user-color)"
                    disabled={tableSettings.length >= maxColumns}
                    onclick={addColumn}
                >
                <Icon.Plus size="16" />
                    <span class="min-w-0">
                        <span class="block truncate text-xs font-semibold">Ajouter une colonne</span>
                    </span>
                </Button>
            {/if}
        {/snippet}

        {#snippet detail()}
            {#if currentTableSetting}
                <div class="grid gap-4 px-4 pb-4 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.6fr)]">
                    <aside class="relative min-h-64 overflow-hidden rounded-lg border border-(--light-bg3) bg-(--light-bg2)">
                        <div class="flex items-center justify-between gap-3 absolute w-full p-5 z-50">
                            <div class="text-xs font-semibold uppercase tracking-widest text-(--grey)">Aperçu</div>
                            <!-- {#if unsavedChanges}
                                <span class="shrink-0 rounded-sm bg-(--orange)/10 px-2 py-0.5 text-[10px] font-semibold text-(--orange)">
                                    Non enregistré
                                </span>
                            {/if} -->
                        </div>

                        <div class="absolute left-1/2 top-1/2 w-[560px] origin-center -translate-x-[42%] -translate-y-1/2 scale-125">
                            <div class="flex min-h-0 flex-col overflow-hidden rounded-xl border border-(--light-bg3) bg-(--light-bg1)">
                                <div class="min-h-0 overflow-hidden">
                                    <div class="flex min-w-fit flex-col bg-(--light-bg1)" aria-label="Aperçu de table">
                                        <div class="sticky top-0 z-20 w-full">
                                            <div class="flex min-w-fit items-stretch border-b border-(--light-bg3) bg-(--light-bg2)">
                                                <div class="group relative flex h-10 w-36 min-w-36 items-center gap-2 overflow-hidden border-r border-(--light-bg3) px-2">
                                                    <span class="min-w-0 truncate text-xs font-medium uppercase tracking-wider text-(--grey)">ID</span>
                                                </div>
                                                <div class="group relative flex h-10 w-52 min-w-52 items-center gap-2 overflow-hidden border-r border-(--light-bg3) px-2">
                                                    <span class="min-w-0 truncate text-xs font-medium uppercase tracking-wider text-(--dark-bg1)">
                                                        {currentTableSetting.title || "Nouvelle colonne"}
                                                    </span>
                                                </div>
                                                <div class="group relative flex h-10 w-36 min-w-36 items-center gap-2 overflow-hidden border-r border-(--light-bg3) px-2">
                                                    <span class="min-w-0 truncate text-xs font-medium uppercase tracking-wider text-(--grey)">Statut</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div class="w-full">
                                            {#each previewTableRows as row (row.id)}
                                                <div class="data-table-row group flex h-9 min-h-9 min-w-fit items-stretch border-b border-(--light-bg3) text-sm no-underline transition-colors duration-(--animation-duration-150) last:border-b-0">
                                                    <div class="flex h-9 min-h-9 w-36 min-w-36 items-center overflow-hidden px-2 text-sm text-(--dark-bg1)">
                                                        <span class="min-w-0 truncate font-mono text-[13px] font-medium text-(--grey)">{row.id}</span>
                                                    </div>
                                                    <div class="flex h-9 min-h-9 w-52 min-w-52 items-center overflow-hidden px-2 text-sm text-(--dark-bg1)">
                                                        <span class="min-w-0 truncate">
                                                            <DisplayValue
                                                                value={row.value}
                                                                display={currentTableSetting.dataOrigin === "state" ? "state" : currentTableSetting.display ?? "text"}
                                                                setting={currentTableSetting}
                                                                states={previewStates}
                                                            />
                                                        </span>
                                                    </div>
                                                    <div class="flex h-9 min-h-9 w-36 min-w-36 items-center overflow-hidden px-2 text-sm text-(--dark-bg1)">
                                                        <DisplayValue
                                                            value={row.state}
                                                            display="state"
                                                            states={previewStates}
                                                        />
                                                    </div>
                                                </div>
                                            {/each}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="pointer-events-none absolute inset-x-0 bottom-0 h-full w-16 bg-gradient-to-r from-(--light-bg2) to-transparent"></div>
                        <div class="pointer-events-none absolute inset-x-0 bottom-0 left-auto h-full w-16 bg-gradient-to-l from-(--light-bg2) to-transparent"></div>
                    </aside>

                    <div class="grid content-start gap-4">
                        <section class="grid gap-3 md:grid-cols-2">
                            <TextInput
                                name="title"
                                label="Titre de la colonne"
                                bind:value={currentTableSetting.title}
                                required
                                helpText="Nom visible dans l'en-tête du tableau."
                                helpTextIcon
                                icon="Columns3"
                                iconSide="left"
                                oninput={commitCurrent}
                            />
                    <Select
                        name="dataOrigin"
                        label="Donnée"
                        bind:value={currentTableSetting.dataOrigin}
                        onchange={handleCurrentDataOriginChange}
                        allowDeselect={false}
                        required
                        helpText="La source détermine les types d'affichage disponibles."
                        helpTextIcon
                        options={[
                            {
                                label: "Par défaut",
                                options: defaultDataOptions,
                            },
                            ...formLabels.map((section) => ({
                                label: section.title,
                                options: section.content.map((item) => ({
                                    label: item.title,
                                    value: fieldOrigin(section, item),
                                })),
                            })),
                        ]}
                    />
                        </section>

                    {#if currentTableSetting.dataOrigin !== "state"}
                        <DisplayInput
                            name="display"
                            label="Type d'affichage"
                            description="Options adaptées au type de donnée sélectionné."
                            bind:value={currentTableSetting.display}
                            options={currentDisplayOptions}
                            setting={currentTableSetting}
                            sampleValue={currentPreviewValue}
                            showPreview={false}
                            groupClass="grid grid-cols-2 gap-2 xl:grid-cols-3"
                            parentClass="min-h-16"
                            onchange={commitCurrent}
                        />
                    {/if}

                    {#if currentTableSetting.display === "date"}
                        <DateFormatInput
                            name="format"
                            label="Format d’affichage"
                            bind:value={currentTableSetting.format}
                            required
                            allowLiteralPercent
                            previewDate={String(currentPreviewValue || "2026-06-12")}
                            helpText="Détermine la présentation de la date dans cette colonne."
                            helpTextIcon
                            oninput={commitCurrent}
                        />
                    {:else if currentTableSetting.display === "text"}
                        <div class="flex flex-col gap-1">
                            <span class="input-label">Style du texte</span>
                            <div class="flex items-center gap-2">
                                <Checkbox
                                    box
                                    icon="Bold"
                                    checkbox={false}
                                    value={Boolean(currentTableSetting.setting?.bold)}
                                    class="size-9! min-h-9! w-9! items-center! rounded-md! p-0!"
                                    parentClass="w-fit"
                                    on:change={(event) => updateCurrentSetting("bold", event.detail)}
                                />
                                <Checkbox
                                    box
                                    icon="Italic"
                                    checkbox={false}
                                    value={Boolean(currentTableSetting.setting?.italic)}
                                    class="size-9! min-h-9! w-9! items-center! rounded-md! p-0!"
                                    parentClass="w-fit"
                                    on:change={(event) => updateCurrentSetting("italic", event.detail)}
                                />
                                <Checkbox
                                    box
                                    icon="Underline"
                                    checkbox={false}
                                    value={Boolean(currentTableSetting.setting?.underline)}
                                    class="size-9! min-h-9! w-9! items-center! rounded-md! p-0!"
                                    parentClass="w-fit"
                                    on:change={(event) => updateCurrentSetting("underline", event.detail)}
                                />
                                <Checkbox
                                    box
                                    icon="Strikethrough"
                                    checkbox={false}
                                    value={Boolean(currentTableSetting.setting?.strikethrough)}
                                    class="size-9! min-h-9! w-9! items-center! rounded-md! p-0!"
                                    parentClass="w-fit"
                                    on:change={(event) => updateCurrentSetting("strikethrough", event.detail)}
                                />
                            </div>
                        </div>
                    {:else if currentTableSetting.display === "badge"}
                        <div class="grid gap-3 md:grid-cols-[auto_1fr]">
                            <IconPicker
                                label="Icône et couleur"
                                value={String(currentTableSetting.setting?.badgeIcon ?? "")}
                                fallback="Tag"
                                allowDeselect
                                showColors
                                toneBackground
                                color={String(currentTableSetting.setting?.badgeColor ?? "")}
                                fallbackColor=""
                                helpText="Personnalise le badge dans les cellules."
                                helpTextIcon
                                onSelect={(badgeIcon) => updateCurrentSetting("badgeIcon", badgeIcon)}
                                onColorSelect={(badgeColor) => updateCurrentSetting("badgeColor", badgeColor)}
                            />
                        </div>
                    {/if}
                    </div>
                </div>
            {/if}
        {/snippet}

        {#snippet actions(item)}
            {@const setting = settingById(item?.id ?? null)}
            {#if setting}
                <Button
                    variant="error"
                    size="sm"
                    icon="Trash2"
                    label="Supprimer"
                    class="w-fit px-2.5 font-semibold"
                    confirm
                    confirmTitle="Supprimer cette colonne ?"
                    confirmDescription="La colonne sera retirée de la liste."
                    confirmCancelLabel="Annuler"
                    confirmConfirmLabel="Supprimer"
                    confirmConfirmVariant="error"
                    onclick={() => removeColumn(setting)}
                />
            {/if}
            <Button
                size="sm"
                icon={isSaving ? "LoaderCircle" : "Save"}
                iconAnimation={isSaving ? "spin" : undefined}
                label={isSaving ? "Enregistrement..." : "Enregistrer"}
                class="w-fit px-2.5 font-semibold"
                disabled={!unsavedChanges || isSaving || !formId}
                onclick={saveColumns}
            />
        {/snippet}
    </SettingsDrilldownList>
    {/if}
</div>
