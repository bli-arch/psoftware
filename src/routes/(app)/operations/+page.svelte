<script lang="ts">
    import MyPopover from "$lib/components/MyPopover.svelte";
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import FiltersPopover from "$lib/components/FiltersPopover.svelte";
    import { Button, DateInput, Select, TextInput } from "$lib/components/istyler";
    import { Popover } from "bits-ui";
    import * as Icon from "lucide-svelte";
    import { onDestroy, onMount } from "svelte";
    import { get, writable, type Readable, type Writable } from "svelte/store";
    import {
        DataBodyRow,
        Render,
        Subscribe,
        type BodyRow,
        type HeaderRow,
        type TableViewModel,
    } from "svelte-headless-table";
    import type { AnyPlugins } from "svelte-headless-table/plugins";

    import LucideIcon from "$lib/components/Badge/LucideIcon.svelte";
    import { currentUser } from "$lib/auth";
    import { cssColor } from "$lib/color";
    import { FormManager } from "$lib/components/FormBuilder";
    import { appSettings } from "$lib/settings";
    import { operationPlural, operationPluralLower, operationSingularLower } from "$lib/operationDisplay";
    import { uiPreferences } from "$lib/uiPreferences";
    import {
        TABLE_ROW_HEIGHT_CLASSES as rowHeightClasses,
        pageRangeEnd,
        pageRangeStart,
        visiblePages,
    } from "$lib/components/table/tableLayout";
    import {
        TABLE_PAGE_SIZE_SELECT_OPTIONS,
        persistTablePageSize,
        readTablePageSize,
    } from "$lib/components/table/pageSizePreference";
    import {
        persistTableOrdering,
        readTableOrdering,
        type TableSortKey,
    } from "$lib/components/table/orderingPreference";
    import { OPERATION_COLUMNS } from "$lib/workspaceSetup";
    import OperationForm from "./OperationForm.svelte";
    import { getOperations, isLoading, loadOperationConfig, setupTable, type Operation } from "./createTable";
    import DisplayValue from "$lib/components/table/DisplayValue.svelte";

    type TableSetting = {
        id: string | number;
        title: string;
        dataOrigin?: string;
        display?: string;
    };
    type FilterOperator =
        | "contains"
        | "equals"
        | "starts_with"
        | "ends_with"
        | "is_empty"
        | "is_not_empty"
        | "before"
        | "after";
    type FilterRow = { field: string; operator: FilterOperator; value: string };

    function createEmptyFilter(): FilterRow {
        return { field: "", operator: "contains", value: "" };
    }

    const FILTER_STORAGE_KEY = "operations.table.filters.v1";
    const STATUS_FILTER_FIELD = "state.name";
    const STATUS_FILTER_OPERATOR: FilterOperator = "equals";

    let viewModel = $state<TableViewModel<Operation> | null>(null);
    let headerRows: Readable<HeaderRow<Operation>[]> = writable([]);
    let tableAttrs: Readable<Record<string, unknown>> = writable({});
    let tableBodyAttrs: Readable<Record<string, unknown>> = writable({});
    let pageRows: Readable<BodyRow<Operation, AnyPlugins>[]> = writable([]);

    let filterValue: Writable<string> = writable("");
    let pageIndex: Writable<number> = writable(0);
    let pageCount: Writable<number> = writable(0);
    let pageSize: Writable<number> = writable(15);
    let hasNextPage: Writable<boolean> = writable(false);
    let hasPreviousPage: Writable<boolean> = writable(false);
    let columnWidths: Writable<Record<string, number>> = writable({});
    let data: Writable<Operation[]> = writable([]);
    let serverItemCount: Writable<number> = writable(0);

    let localTableSettings = $state<TableSetting[]>([]);
    let localStates = $state<Array<Record<string, any>>>([]);
    let localFormConfig = $state<Record<string, any> | null>(null);
    let filterRows = $state<FilterRow[]>([createEmptyFilter()]);
    let configLoading = $state(true);
    let loadError = $state("");
    let noFormDetected = $state(false);
    let noColumnsConfigured = $state(false);
    let noIdentifierConfigured = $state(false);
    let noStatusConfigured = $state(false);
    let filterPopoverOpen = $state(false);
    let statusPopoverOpen = $state(false);
    let unsubscribers: Array<() => void> = [];

    const activeFilters = writable<FilterRow[]>([]);
    const can = (key: string) => Boolean($currentUser?.administrator || $currentUser?.permissions?.includes(key));

    const operatorLabels: Record<FilterOperator, string> = {
        contains: "Contient",
        equals: "Est égal à",
        starts_with: "Commence par",
        ends_with: "Termine par",
        is_empty: "Est vide",
        is_not_empty: "N'est pas vide",
        before: "Avant le",
        after: "Après le",
    };

    const textOperators = [
        "contains",
        "equals",
        "starts_with",
        "ends_with",
        "is_empty",
        "is_not_empty",
    ] satisfies FilterOperator[];

    const dateOperators = ["equals", "before", "after", "is_empty", "is_not_empty"] satisfies FilterOperator[];

    const filterOptions = () => {
        const options = localTableSettings
            .filter((setting) => setting.dataOrigin)
            .map((setting) => ({
                label: setting.title || setting.dataOrigin || "Champ",
                value: setting.dataOrigin as string,
            }));

        if (!options.some((option) => option.value === STATUS_FILTER_FIELD)) {
            options.push({ label: "Statut", value: STATUS_FILTER_FIELD });
        }

        return options;
    };

    const stateFilterOptions = () =>
        localStates.map((state) => ({
            label: String(state.name ?? `Statut ${state.id}`),
            value: String(state.name ?? state.id),
        }));

    const activeFilterCount = (filters: FilterRow[]) => filters.length;

    const activeStatusValues = (filters: FilterRow[]) =>
        filters
            .filter((filter) => filter.field === STATUS_FILTER_FIELD && filter.operator === STATUS_FILTER_OPERATOR)
            .map((filter) => filter.value);

    const activeStatusCount = (filters: FilterRow[]) => activeStatusValues(filters).length;

    const addFilterRow = () => {
        filterRows = [...filterRows, createEmptyFilter()];
    };

    const removeFilterRow = (index: number) => {
        filterRows = filterRows.filter((_, currentIndex) => currentIndex !== index);
        if (!filterRows.length) filterRows = [createEmptyFilter()];
    };

    const persistFilters = (filters: FilterRow[]) => {
        if (typeof localStorage === "undefined") return;

        try {
            localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
        } catch (error) {
            console.warn("Unable to persist operation filters", error);
        }
    };

    const readPersistedFilters = () => {
        if (typeof localStorage === "undefined") return [];

        try {
            const parsed = JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY) || "[]");
            if (!Array.isArray(parsed)) return [];

            return parsed.reduce<FilterRow[]>((filters, row) => {
                if (
                    row &&
                    typeof row.field === "string" &&
                    typeof row.operator === "string" &&
                    typeof row.value === "string"
                ) {
                    filters.push({
                        field: row.field,
                        operator: row.operator as FilterOperator,
                        value: row.value,
                    });
                }
                return filters;
            }, []);
        } catch {
            return [];
        }
    };

    const normalizeFilters = (rows: FilterRow[]) =>
        rows.reduce<FilterRow[]>((filters, row) => {
            const field = row.field.trim();
            const value = row.value.trim();
            const allowedOperators = operatorsForField(field).map((option) => option.value);
            const operator = allowedOperators.includes(row.operator)
                ? row.operator
                : isDateFilter(field)
                    ? "equals"
                    : "contains";

            if (field && isAllowedFilterField(field) && (operatorNeedsValue(operator) ? value : true)) {
                filters.push({ field, operator, value });
            }
            return filters;
        }, []);

    const setActiveFilters = (filters: FilterRow[]) => {
        activeFilters.set(filters);
        filterRows = filters.length ? filters.map((filter) => ({ ...filter })) : [createEmptyFilter()];
        persistFilters(filters);
    };

    const clearFilters = async (sortKeys?: Writable<TableSortKey[]>) => {
        setActiveFilters([]);
        filterPopoverOpen = false;
        statusPopoverOpen = false;
        pageIndex.set(0);
        await refreshData(1, sortKeys);
    };

    const buildQuery = (sortKeys?: Writable<TableSortKey[]>) => {
        const filters = get(activeFilters);
        const base: Record<string, string | string[]> = { search: get(filterValue) };
        const first = sortKeys ? get(sortKeys)?.[0] : undefined;
        if (filters.length) {
            base.filter_field = filters.map((filter) => filter.field);
            base.filter_operator = filters.map((filter) => filter.operator);
            base.filter_value = filters.map((filter) => filter.value);
        }

        if (!first?.id || !first.order) return base;

        const setting = localTableSettings.find((item) => String(item.id) === String(first.id));
        const orderingField = setting?.dataOrigin;

        return orderingField
            ? { ...base, ordering: `${first.order === "desc" ? "-" : ""}${orderingField}` }
            : base;
    };

    const refreshData = async (page = get(pageIndex) + 1, sortKeys?: Writable<TableSortKey[]>) => {
        const nextData = await getOperations(page, get(pageSize), buildQuery(sortKeys));
        data.set(nextData);
    };

    const applyFilters = async (sortKeys?: Writable<TableSortKey[]>) => {
        const nextFilters = normalizeFilters(filterRows);
        setActiveFilters(nextFilters);
        filterPopoverOpen = false;
        pageIndex.set(0);
        await refreshData(1, sortKeys);
    };

    const removeActiveFilter = async (index: number, sortKeys?: Writable<TableSortKey[]>) => {
        const nextFilters = get(activeFilters).filter((_, currentIndex) => currentIndex !== index);
        setActiveFilters(nextFilters);
        pageIndex.set(0);
        await refreshData(1, sortKeys);
    };

    const toggleStatusFilter = async (value: string, sortKeys?: Writable<TableSortKey[]>) => {
        const currentFilters = get(activeFilters);
        const isActive = currentFilters.some(
            (filter) =>
                filter.field === STATUS_FILTER_FIELD &&
                filter.operator === STATUS_FILTER_OPERATOR &&
                filter.value === value,
        );
        const nextFilters = isActive
            ? currentFilters.filter(
                  (filter) =>
                      !(
                          filter.field === STATUS_FILTER_FIELD &&
                          filter.operator === STATUS_FILTER_OPERATOR &&
                          filter.value === value
                      ),
              )
            : [...currentFilters, { field: STATUS_FILTER_FIELD, operator: STATUS_FILTER_OPERATOR, value }];

        setActiveFilters(nextFilters);
        pageIndex.set(0);
        await refreshData(1, sortKeys);
    };

    const getFilterSetting = (field: string) =>
        localTableSettings.find((setting) => setting.dataOrigin === field);

    const isAllowedFilterField = (field: string) =>
        field === STATUS_FILTER_FIELD || Boolean(getFilterSetting(field));

    const isDateFilter = (field: string) => {
        const setting = getFilterSetting(field);
        return field === "created_at" || setting?.display === "date";
    };

    const isStateFilter = (field: string) => field === "state" || field === "state.name";

    const operatorNeedsValue = (operator: FilterOperator) =>
        operator !== "is_empty" && operator !== "is_not_empty";

    const operatorsForField = (field: string) =>
        (isDateFilter(field) ? dateOperators : textOperators).map((operator) => ({
            value: operator,
            label: operatorLabels[operator],
        }));

    const getStateFilterState = (value: string) =>
        localStates.find((state) => String(state.name ?? state.id) === value || String(state.id) === value);

    const getStateFilterId = (value: string) => getStateFilterState(value)?.id ?? value;

    const setFilterValue = (index: number, value: string) => {
        filterRows = filterRows.map((filter, currentIndex) =>
            currentIndex === index ? { ...filter, value } : filter,
        );
    };

    const getFilterLabel = (filter: FilterRow) => {
        const fieldLabel = filter.field === STATUS_FILTER_FIELD
            ? "Statut"
            : getFilterSetting(filter.field)?.title ?? filter.field;
        if (!operatorNeedsValue(filter.operator)) return `${fieldLabel} ${operatorLabels[filter.operator].toLowerCase()}`;
        return `${fieldLabel} ${operatorLabels[filter.operator].toLowerCase()} "${filter.value}"`;
    };

    $effect(() => {
        if (!filterRows.length) {
            filterRows = [createEmptyFilter()];
            return;
        }

        const normalizedRows = filterRows.map((row) => {
            const allowedOperators = operatorsForField(row.field).map((option) => option.value);
            if (allowedOperators.includes(row.operator)) return row;

            const operator: FilterOperator = isDateFilter(row.field) ? "equals" : "contains";
            return {
                ...row,
                operator,
            };
        });

        if (normalizedRows.some((row, index) => row !== filterRows[index])) {
            filterRows = normalizedRows;
        }
    });

    const retryLoad = async () => {
        viewModel = null;
        loadError = "";
        noFormDetected = false;
        noColumnsConfigured = false;
        noIdentifierConfigured = false;
        noStatusConfigured = false;
        await initialiseTable();
    };

    async function initialiseTable() {
        configLoading = true;
        localFormConfig = null;
        let sortKeys: Writable<TableSortKey[]> | undefined;
        let subscriptionsReady = false;

        unsubscribers.forEach((unsubscribe) => unsubscribe());
        unsubscribers = [];

        try {
            const config = await loadOperationConfig(true);
            localTableSettings = config.tableSettings;
            localStates = config.states;
            localFormConfig = config.form;
            const initialPageSize = readTablePageSize("operations", config.pageSize);
            pageSize = writable(initialPageSize);
            const sortableColumnIds = config.tableSettings
                .filter((setting) => typeof setting.dataOrigin === "string" && setting.dataOrigin.trim())
                .map((setting) => setting.id);
            const storedOrdering = readTableOrdering("operations", sortableColumnIds);
            const initialSortKeys = storedOrdering ? [storedOrdering] : [];
            sortKeys = writable(initialSortKeys);

            if (!config.form) {
                noFormDetected = true;
                return;
            }

            if (!config.tableSettings.length) {
                noColumnsConfigured = true;
                return;
            }

            if (typeof config.form.settings?.IDFormat !== "string" || !config.form.settings.IDFormat.trim()) {
                noIdentifierConfigured = true;
                return;
            }

            if (!config.states.length) {
                noStatusConfigured = true;
                return;
            }

            const requestedStatus = page.url.searchParams.get("status")?.trim();
            setActiveFilters(normalizeFilters(requestedStatus
                ? [{ field: STATUS_FILTER_FIELD, operator: STATUS_FILTER_OPERATOR, value: requestedStatus }]
                : readPersistedFilters()));

            const operations = await getOperations(1, initialPageSize, buildQuery(sortKeys));
            const initialWidths =
                typeof localStorage !== "undefined"
                    ? JSON.parse(localStorage.getItem("columnWidths") || "{}")
                    : {};

            const tableConfig = setupTable(operations, initialWidths, initialPageSize, initialSortKeys);
            data = tableConfig.data;
            serverItemCount = tableConfig.serverItemCount;
            viewModel = tableConfig.table.createViewModel(tableConfig.columns);

            headerRows = viewModel.headerRows;
            tableAttrs = viewModel.tableAttrs;
            tableBodyAttrs = viewModel.tableBodyAttrs;
            pageRows = viewModel.pageRows;

            filterValue = viewModel.pluginStates.tableFilter.filterValue;
            ({ pageIndex, pageCount, pageSize, hasNextPage, hasPreviousPage } = viewModel.pluginStates.page);
            ({ columnWidths } = viewModel.pluginStates.resize);
            ({ sortKeys } = viewModel.pluginStates.sort as { sortKeys: Writable<TableSortKey[]> });

            if (typeof localStorage !== "undefined") {
                unsubscribers.push(
                    columnWidths.subscribe((widths) => {
                        localStorage.setItem("columnWidths", JSON.stringify(widths));
                    }),
                );
            }

            unsubscribers.push(
                pageIndex.subscribe(async (nextPageIndex) => {
                    if (!subscriptionsReady) return;
                    await refreshData(nextPageIndex + 1, sortKeys);
                }),
            );

            unsubscribers.push(
                pageSize.subscribe(async (nextPageSize) => {
                    persistTablePageSize("operations", nextPageSize);
                    if (!subscriptionsReady) return;
                    if (get(pageIndex) !== 0) pageIndex.set(0);
                    else {
                        const nextData = await getOperations(1, nextPageSize, buildQuery(sortKeys));
                        data.set(nextData);
                    }
                }),
            );

            let filterTimeout: ReturnType<typeof setTimeout>;
            unsubscribers.push(
                filterValue.subscribe((value) => {
                    if (!subscriptionsReady) return;
                    clearTimeout(filterTimeout);
                    filterTimeout = setTimeout(async () => {
                        pageIndex.set(0);
                        const nextData = await getOperations(1, get(pageSize), {
                            ...buildQuery(sortKeys),
                            search: value,
                        });
                        data.set(nextData);
                    }, 300);
                }),
            );

            unsubscribers.push(
                sortKeys.subscribe(async (nextSortKeys) => {
                    if (!subscriptionsReady) return;
                    persistTableOrdering("operations", nextSortKeys[0] ?? null, sortableColumnIds);
                    if (get(pageIndex) !== 0) pageIndex.set(0);
                    else await refreshData(1, sortKeys);
                }),
            );

            subscriptionsReady = true;
        } catch (error) {
            console.error("Failed to load operations table", error);
            loadError = `Impossible de charger les ${operationPluralLower(get(appSettings).value.operation)}.`;
        } finally {
            configLoading = false;
        }
    }

    onMount(initialiseTable);

    onDestroy(() => {
        unsubscribers.forEach((unsubscribe) => unsubscribe());
    });
</script>

<div class="flex h-full w-full flex-col overflow-hidden">
    <div class="flex h-14 min-h-14 shrink-0 items-center justify-between border-b border-(--light-bg3) bg-(--light-bg1) px-6">
        <div class="min-w-0">
            <h1 class="truncate text-lg font-bold text-(--dark-bg1)">{operationPlural($appSettings.value.operation)}</h1>
        </div>

        {#if !configLoading && localFormConfig && can("operations.create") && !noFormDetected && !noColumnsConfigured && !noIdentifierConfigured && !noStatusConfigured}
            <OperationForm
                direction="right"
                initialFormConfig={localFormConfig}
                initialStates={localStates}
            >
                {#snippet children(builder)}
                    <Button {builder} icon="Plus" label={`Nouvelle ${operationSingularLower($appSettings.value.operation)}`} class="w-fit" />
                {/snippet}
            </OperationForm>
        {/if}
    </div>

    {#if !configLoading && noFormDetected}
        <section class="flex min-h-0 flex-1 items-center justify-center px-6 py-5">
            <div class="flex flex-col items-center gap-3 text-center">
                <div>
                    <p class="text-sm font-semibold text-(--dark-bg1)">Aucun formulaire actif</p>
                    <p class="mt-1 text-xs text-(--grey)">
                        {can("settings.operation.modify")
                            ? `Créez un formulaire avant d'ajouter une ${operationSingularLower($appSettings.value.operation)}.`
                            : "Le formulaire nécessaire n’a pas encore été configuré par votre administrateur."}
                    </p>
                </div>
                {#if can("settings.operation.modify")}
                    <FormManager
                        formType="operation"
                        triggerLabel="Créer un formulaire"
                        defaultPageTitles={["Informations"]}
                        newFormSettings={{ tableSettings: OPERATION_COLUMNS, pageSize: 15 }}
                        onSaved={() => void retryLoad()}
                    />
                {/if}
            </div>
        </section>
    {:else if !configLoading && noColumnsConfigured}
        <section class="flex min-h-0 flex-1 items-center justify-center px-6 py-5">
            <div class="flex flex-col items-center gap-3 text-center">
                <div><p class="text-sm font-semibold text-(--dark-bg1)">Aucune colonne configurée</p><p class="mt-1 text-xs text-(--grey)">Choisissez les informations à afficher dans cette liste.</p></div>
                {#if can("settings.operation.modify")}
                    <Button label="Configurer les colonnes" onclick={() => goto("/settings/operation?open=columns")} class="w-fit" />
                {/if}
            </div>
        </section>
    {:else if !configLoading && noIdentifierConfigured}
        <section class="flex min-h-0 flex-1 items-center justify-center px-6 py-5">
            <div class="flex flex-col items-center gap-3 text-center">
                <div><p class="text-sm font-semibold text-(--dark-bg1)">Identifiant non configuré</p><p class="mt-1 text-xs text-(--grey)">Définissez le format utilisé pour générer automatiquement les identifiants.</p></div>
                {#if can("settings.operation.modify")}
                    <Button label="Configurer les identifiants" onclick={() => goto("/settings/operation?open=identifier")} class="w-fit" />
                {/if}
            </div>
        </section>
    {:else if !configLoading && noStatusConfigured}
        <section class="flex min-h-0 flex-1 items-center justify-center px-6 py-5">
            <div class="flex flex-col items-center gap-3 text-center">
                <div><p class="text-sm font-semibold text-(--dark-bg1)">Aucun statut configuré</p><p class="mt-1 text-xs text-(--grey)">Ajoutez au moins un statut pour commencer à créer des {operationPluralLower($appSettings.value.operation)}.</p></div>
                {#if can("settings.operation.modify")}
                    <Button label="Configurer les statuts" onclick={() => goto("/settings/operation?open=statuses")} class="w-fit" />
                {/if}
            </div>
        </section>
    {:else if !configLoading && loadError}
        <section class="flex min-h-0 flex-1 items-center justify-center px-6 py-5">
            <div class="flex max-w-sm flex-col items-center gap-3 text-center">
                <div class="flex size-10 items-center justify-center rounded-xl border border-(--light-bg3) bg-(--light-bg1) text-(--red)">
                    <Icon.AlertCircle size={18} />
                </div>
                <div>
                    <p class="text-sm font-semibold text-(--dark-bg1)">{loadError}</p>
                    <p class="mt-1 text-xs leading-5 text-(--grey)">Vérifiez la connexion au serveur puis réessayez.</p>
                </div>
                <Button variant="secondary" size="sm" icon="RefreshCw" label="Réessayer" class="w-fit" onclick={retryLoad} />
            </div>
        </section>
    {:else if !configLoading && viewModel}
        <section class="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-6 py-5">
            <div class="flex shrink-0 flex-wrap items-center justify-between gap-3">
                <div class="flex min-w-0 flex-1 items-center gap-2">
                    <div class="w-full max-w-96 min-w-56">
                        <TextInput
                            placeholder={`Rechercher une ${operationSingularLower($appSettings.value.operation)} ou un reçu`}
                            name="operations-search"
                            icon="Search"
                            iconSide="left"
                            bind:value={$filterValue}
                        />
                    </div>

                    <Popover.Root bind:open={filterPopoverOpen}>
                        <Popover.Trigger>
                            {#snippet child({ props })}
                                <Button
                                    {...props}
                                    variant={activeFilterCount($activeFilters) ? "primary" : "secondary"}
                                    size="sm"
                                    icon="SlidersHorizontal"
                                    class="w-fit"
                                >
                                    Filtres
                                    {#if activeFilterCount($activeFilters)}
                                        <span class="ml-1 rounded-full bg-white/20 px-1.5 text-[11px] leading-4">
                                            {activeFilterCount($activeFilters)}
                                        </span>
                                    {/if}
                                </Button>
                            {/snippet}
                        </Popover.Trigger>

                        <MyPopover
                            class="w-[42rem] max-w-[calc(100vw-3rem)] items-stretch rounded-xl p-0"
                            align="start"
                        >
                            <FiltersPopover onadd={addFilterRow}>
                                <div class="flex flex-col gap-2">
                                    {#each filterRows as filter, index}
                                        <div class="grid grid-cols-[minmax(0,1fr)_10rem_minmax(0,1fr)_2rem] items-end gap-2">
                                            <Select
                                                name={`filter-field-${index}`}
                                                label={index === 0 ? "Champ" : undefined}
                                                placeholder="Champ"
                                                bind:value={filter.field}
                                                allowDeselect={false}
                                                options={filterOptions()}
                                            />
                                            <Select
                                                name={`filter-operator-${index}`}
                                                label={index === 0 ? "Condition" : undefined}
                                                placeholder="Condition"
                                                bind:value={filter.operator}
                                                allowDeselect={false}
                                                disabled={!filter.field}
                                                options={operatorsForField(filter.field)}
                                            />
                                            {#if operatorNeedsValue(filter.operator)}
                                                {#if isStateFilter(filter.field)}
                                                    <Select
                                                        name={`filter-value-${index}`}
                                                        label={index === 0 ? "Valeur" : undefined}
                                                        placeholder="Statut"
                                                        value={filter.value}
                                                        options={stateFilterOptions()}
                                                        allowDeselect={false}
                                                        disabled={!filter.field}
                                                        onchange={(value) => setFilterValue(index, String(value ?? ""))}
                                                    />
                                                {:else}
                                                    {#if isDateFilter(filter.field)}
                                                        <DateInput
                                                            name={`filter-value-${index}`}
                                                            label={index === 0 ? "Valeur" : undefined}
                                                            placeholder="Valeur"
                                                            value={filter.value}
                                                            onchange={(value) => setFilterValue(index, value ?? "")}
                                                            clearable={false}
                                                            showFormattedValue={false}
                                                            disabled={!filter.field}
                                                        />
                                                    {:else}
                                                        <TextInput
                                                            name={`filter-value-${index}`}
                                                            label={index === 0 ? "Valeur" : undefined}
                                                            placeholder="Valeur"
                                                            bind:value={filter.value}
                                                            disabled={!filter.field}
                                                        />
                                                    {/if}
                                                {/if}
                                            {:else}
                                                <div class={index === 0 ? "pt-5" : ""}>
                                                    <div class="flex h-8 items-center rounded-lg border border-(--light-bg3) px-3 text-xs text-(--grey)">
                                                        Sans valeur
                                                    </div>
                                                </div>
                                            {/if}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                icon="Trash2"
                                                title="Supprimer"
                                                aria-label="Supprimer"
                                                class="size-8 px-0 text-(--grey) hover:bg-(--light-bg2) hover:text-(--red)"
                                                onclick={() => removeFilterRow(index)}
                                            />
                                        </div>
                                    {/each}
                                </div>

                                {#snippet footer()}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        label="Effacer"
                                        class="w-fit hover:text-(--red)"
                                        onclick={() => clearFilters(viewModel?.pluginStates.sort.sortKeys)}
                                    />
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        icon="Check"
                                        label="Appliquer"
                                        class="w-fit"
                                        onclick={() => applyFilters(viewModel?.pluginStates.sort.sortKeys)}
                                    />
                                {/snippet}
                            </FiltersPopover>
                        </MyPopover>
                    </Popover.Root>

                    <Popover.Root bind:open={statusPopoverOpen}>
                        <Popover.Trigger>
                            {#snippet child({ props })}
                                <Button
                                    {...props}
                                    variant={activeStatusCount($activeFilters) ? "primary" : "secondary"}
                                    size="sm"
                                    icon="CircleDot"
                                    class="w-fit"
                                >
                                    <span>Statut</span>
                                    {#if activeStatusCount($activeFilters)}
                                        <span class="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-white/20 px-1 text-[10px] font-bold tabular-nums">
                                            {activeStatusCount($activeFilters)}
                                        </span>
                                    {/if}
                                </Button>
                            {/snippet}
                        </Popover.Trigger>

                        <MyPopover class="min-w-52 max-w-[calc(100vw-3rem)] items-stretch rounded-lg p-1" align="start">
                            <div class="flex max-h-80 w-full flex-col gap-0.5 overflow-y-auto">
                                {#if localStates.length}
                                    {#each localStates as state (state.id)}
                                        {@const statusValue = String(state.name ?? state.id)}
                                        {@const selected = activeStatusValues($activeFilters).includes(statusValue)}
                                        {@const stateColor = cssColor(state.settings?.color)}
                                        <button
                                            type="button"
                                            class={`flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left transition-colors hover:bg-[color-mix(in_oklab,var(--status-color)_10%,transparent)] ${
                                                selected
                                                    ? "bg-(--light-bg2)"
                                                    : "text-(--dark-bg1)"
                                            }`}
                                            style={`--status-color:${stateColor ?? "var(--grey)"}`}
                                            onclick={() => toggleStatusFilter(statusValue, viewModel?.pluginStates.sort.sortKeys)}
                                        >
                                            <LucideIcon
                                                size={14}
                                                name={state.settings?.icon}
                                                class="shrink-0"
                                                style={stateColor ? `color:${stateColor}` : undefined}
                                            />
                                            <span class="min-w-0 flex-1 truncate text-xs font-medium text-(--dark-bg1)">
                                                {state.name ?? `Statut ${state.id}`}
                                            </span>
                                            {#if selected}
                                                <Icon.Check size={13} class="shrink-0 text-(--green)" />
                                            {/if}
                                        </button>
                                    {/each}
                                {:else}
                                    <div class="px-2 py-1.5 text-xs text-(--grey)">Aucun statut</div>
                                {/if}
                            </div>
                        </MyPopover>
                    </Popover.Root>
                </div>

                <div class="flex items-center gap-2 text-xs font-medium text-(--grey)">
                    {#if $isLoading}
                        <Icon.Loader2 size={14} class="ui-loader-spin" />
                        Chargement
                    {:else}
                        <Icon.Rows3 size={14} />
                        {$serverItemCount} {$serverItemCount > 1 ? operationPluralLower($appSettings.value.operation) : operationSingularLower($appSettings.value.operation)}
                    {/if}
                </div>
            </div>

            {#if activeFilterCount($activeFilters)}
                <div class="flex shrink-0 flex-wrap items-center gap-2">
                    {#each $activeFilters as filter, index}
                        <span class="inline-flex max-w-80 items-center gap-1 rounded-lg border border-(--light-bg3) bg-(--light-bg1) p-1 pl-2 text-xs font-normal text-(--dark-bg1)">
                            {#if isStateFilter(filter.field) && getStateFilterState(filter.value)}
                                <span>Statut</span>
                                <DisplayValue
                                    value={getStateFilterId(filter.value)}
                                    display="state"
                                    states={localStates}
                                    class="max-w-52"
                                />
                            {:else}
                                <span class="truncate">{getFilterLabel(filter)}</span>
                            {/if}
                            <!-- <button
                                type="button"
                                title="Retirer ce filtre"
                                aria-label="Retirer ce filtre"
                                class="ml-1 flex size-5 shrink-0 items-center justify-center rounded-lg text-(--grey) transition-colors hover:bg-(--light-bg3) hover:text-(--red)"
                                onclick={() => removeActiveFilter(index, viewModel?.pluginStates.sort.sortKeys)}
                            >
                                <Icon.X size={12} />
                            </button> -->

                            <Button
                                variant="ghost"
                                size="xs"
                                icon="X"
                                class="px-1 text-(--grey) transition-colors hover:text-(--red)"
                                onclick={() => removeActiveFilter(index, viewModel?.pluginStates.sort.sortKeys)}
                            />
                        </span>
                    {/each}
                    <Button
                        variant="ghost"
                        size="xs"
                        icon="X"
                        label="Tout effacer"
                        class="w-fit text-(--grey) hover:text-(--red)"
                        onclick={() => clearFilters(viewModel?.pluginStates.sort.sortKeys)}
                    />
                </div>
            {/if}

            <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-(--light-bg3) bg-(--light-bg1)">
                <div class="min-h-0 flex-1 overflow-auto">
                    <div class="flex min-h-full min-w-fit flex-col bg-(--light-bg1)" {...$tableAttrs} aria-label={`Liste des ${operationPluralLower($appSettings.value.operation)}`}>
                        <div class="sticky top-0 z-20 w-full">
                            {#each $headerRows as headerRow (headerRow.id)}
                                <Subscribe rowAttrs={headerRow.attrs()} let:rowAttrs>
                                    <div class="flex min-w-fit items-stretch border-b border-(--light-bg3) bg-(--light-bg2)" {...rowAttrs}>
                                        {#each headerRow.cells as cell, cellIndex (cell.id)}
                                            <Subscribe attrs={cell.attrs()} let:attrs props={cell.props()} let:props>
                                                {@const pluginProps = props as {
                                                    sort: { toggle: () => void; order?: "asc" | "desc"; disabled: boolean };
                                                    resize: {
                                                        disabled: boolean;
                                                        drag: (node: HTMLElement) => void;
                                                        reset: (node: HTMLElement) => void;
                                                    };
                                                }}
                                                {@const sort = {
                                                    ...pluginProps.sort,
                                                    disabled: cell.state?.columns[cellIndex].plugins?.sort?.disable ?? false,
                                                }}

                                                <div
                                                    class={`group relative flex min-w-36 items-center gap-2 overflow-hidden border-r border-(--light-bg3) px-2 ${rowHeightClasses[$uiPreferences.density]}`}
                                                    {...attrs}
                                                >
                                                    <Button
                                                        variant="ghost"
                                                        size="xs"
                                                        disabled={sort.disabled}
                                                        class={`h-auto min-w-0 flex-1 justify-start gap-1 rounded-md px-0 py-0 text-left text-xs font-medium uppercase tracking-wider hover:bg-transparent hover:text-(--dark-bg1) disabled:cursor-default ${
                                                            sort.order ? "text-(--dark-bg1)" : "text-(--grey)"
                                                        }`}
                                                        onclick={sort.disabled ? undefined : sort.toggle}
                                                    >
                                                        <span class="min-w-0 truncate"><Render of={cell.render()} /></span>
                                                        {#if !sort.disabled}
                                                            {#if sort.order === "asc"}
                                                                <Icon.ArrowUp size={13} class="shrink-0 text-(--dark-bg1)" />
                                                            {:else if sort.order === "desc"}
                                                                <Icon.ArrowDown size={13} class="shrink-0 text-(--dark-bg1)" />
                                                            {:else}
                                                                <Icon.ChevronsUpDown size={13} class="shrink-0 opacity-60" />
                                                            {/if}
                                                        {/if}
                                                    </Button>

                                                    {#if !pluginProps.resize.disabled}
                                                        <div
                                                            role="separator"
                                                            aria-orientation="vertical"
                                                            aria-label="Redimensionner la colonne"
                                                            class="absolute -right-1 top-0 bottom-0 z-10 w-3 cursor-col-resize"
                                                            use:pluginProps.resize.drag
                                                            use:pluginProps.resize.reset
                                                        ></div>
                                                    {/if}
                                                </div>
                                            </Subscribe>
                                        {/each}
                                    </div>
                                </Subscribe>
                            {/each}
                        </div>

                        <div class="w-full" {...$tableBodyAttrs}>
                            {#if $pageRows.length}
                                {#each $pageRows as rowRaw (rowRaw.id)}
                                    {@const row = rowRaw as DataBodyRow<Operation, AnyPlugins>}
                                    <Subscribe rowAttrs={row.attrs()}>
                                        <a
                                            class={`data-table-row group flex min-w-fit items-stretch border-b last:border-b-0 border-(--light-bg3) text-sm no-underline transition-colors duration-(--animation-duration-150) hover:bg-(--light-bg2) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--user-color) ${rowHeightClasses[$uiPreferences.density]}`}
                                            href={`/operations/${row.original.uid}`}
                                            aria-label={`Ouvrir ${operationSingularLower($appSettings.value.operation)} ${row.original.uid}`}
                                        >
                                            {#each row.cells as cell (cell.id)}
                                                <Subscribe attrs={cell.attrs()} let:attrs>
                                                    <div
                                                        class={`flex min-w-36 items-center overflow-hidden px-2 text-sm text-(--dark-bg1) ${rowHeightClasses[$uiPreferences.density]}`}
                                                        {...attrs}
                                                    >
                                                        <span class="min-w-0 truncate"><Render of={cell.render()} /></span>
                                                    </div>
                                                </Subscribe>
                                            {/each}
                                        </a>
                                    </Subscribe>
                                {/each}
                            {:else}
                                {#if activeFilterCount($activeFilters) || $filterValue}
                                <div class="flex min-h-72 min-w-full flex-col items-center justify-center gap-3 px-8 text-center">
                                    <div class="flex size-10 items-center justify-center rounded-xl border border-(--light-bg3) bg-(--light-bg2) text-(--grey)">
                                        <Icon.SearchX size={18} />
                                    </div>
                                    <div>
                                        <p class="text-sm font-semibold text-(--dark-bg1)">Aucune {operationSingularLower($appSettings.value.operation)}</p>
                                        <p class="mt-1 text-xs leading-5 text-(--grey)">Aucun enregistrement ne correspond à la recherche ou aux filtres actifs.</p>
                                    </div>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        label="Réinitialiser"
                                        class="w-fit"
                                        onclick={async () => {
                                            $filterValue = "";
                                            await clearFilters(viewModel?.pluginStates.sort.sortKeys);
                                        }}
                                    />
                                </div>
                                {:else}
                                    <div class="flex min-h-72 min-w-full items-center justify-center px-8 text-sm text-(--grey)">Aucune donnée.</div>
                                {/if}
                            {/if}
                        </div>
                    </div>
                </div>

                <div class="flex h-12.5 shrink-0 items-center justify-between gap-3 border-t border-(--light-bg3) bg-(--light-bg2) px-2">
                    <p class="min-w-44 text-xs font-medium tabular-nums text-(--grey)">
                        {pageRangeStart($serverItemCount, $pageIndex, $pageSize)}-{pageRangeEnd($serverItemCount, $pageIndex, $pageSize)}
                        sur {$serverItemCount}
                    </p>

                    <div class="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            icon="ChevronsLeft"
                            title="Première page"
                            aria-label="Première page"
                            class="size-8 px-0 hover:bg-(--light-bg3) disabled:cursor-not-allowed disabled:opacity-30"
                            disabled={!$hasPreviousPage}
                            onclick={() => pageIndex.set(0)}
                        />
                        <Button
                            variant="ghost"
                            size="sm"
                            icon="ChevronLeft"
                            title="Page précédente"
                            aria-label="Page précédente"
                            class="size-8 px-0 hover:bg-(--light-bg3) disabled:cursor-not-allowed disabled:opacity-30"
                            disabled={!$hasPreviousPage}
                            onclick={() => pageIndex.set($pageIndex - 1)}
                        />

                        <div class="hidden items-center gap-1 sm:flex">
                            {#each visiblePages($pageIndex, $pageCount) as page, visibleIndex}
                                {#if visibleIndex > 0 && page - visiblePages($pageIndex, $pageCount)[visibleIndex - 1] > 1}
                                    <span class="flex size-8 items-center justify-center text-xs text-(--grey)">...</span>
                                {/if}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    label={String(page + 1)}
                                    aria-label={`Page ${page + 1}`}
                                    class={`size-8 px-0 text-xs ${
                                        $pageIndex === page
                                            ? "bg-(--user-color) text-white hover:bg-(--user-color-darker)"
                                            : "text-(--dark-bg1) hover:bg-(--light-bg3)"
                                    }`}
                                    onclick={() => pageIndex.set(page)}
                                />
                            {/each}
                        </div>

                        <Button
                            variant="ghost"
                            size="sm"
                            icon="ChevronRight"
                            title="Page suivante"
                            aria-label="Page suivante"
                            class="size-8 px-0 hover:bg-(--light-bg3) disabled:cursor-not-allowed disabled:opacity-30"
                            disabled={!$hasNextPage}
                            onclick={() => pageIndex.set($pageIndex + 1)}
                        />
                        <Button
                            variant="ghost"
                            size="sm"
                            icon="ChevronsRight"
                            title="Dernière page"
                            aria-label="Dernière page"
                            class="size-8 px-0 hover:bg-(--light-bg3) disabled:cursor-not-allowed disabled:opacity-30"
                            disabled={!$hasNextPage}
                            onclick={() => pageIndex.set(Math.max($pageCount - 1, 0))}
                        />
                    </div>

                    <div class="flex min-w-44 items-center justify-end gap-2 text-xs font-medium text-(--dark-bg1)">
                        <span>Afficher</span>
                        <div class="w-20">
                            <Select
                                name="operations-page-size"
                                bind:value={$pageSize}
                                allowDeselect={false}
                                options={TABLE_PAGE_SIZE_SELECT_OPTIONS}
                            />
                        </div>
                        <span>par page</span>
                    </div>
                </div>
            </div>
        </section>
    {:else}
        <section class="flex min-h-0 flex-1 items-center justify-center gap-2 px-6 py-5 text-sm text-(--grey)">
            <Icon.Loader2 size={16} class="ui-loader-spin" />
            Chargement des {operationPluralLower($appSettings.value.operation)}...
        </section>
    {/if}
</div>
