<script lang="ts">
    import { goto } from "$app/navigation";
    import { currentUser } from "$lib/auth";
    import { StateBadge } from "$lib/components/Badge";
    import LucideIcon from "$lib/components/Badge/LucideIcon.svelte";
    import { Button, Select, TextInput } from "$lib/components/istyler";
    import MyPopover from "$lib/components/MyPopover.svelte";
    import DisplayValue from "$lib/components/table/DisplayValue.svelte";
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
    import { cssColor } from "$lib/color";
    import { bootstrapSettings } from "$lib/settings";
    import {
        TEAM_DETAIL_PERMISSIONS,
        getAssignableRoles,
        memberDisplayName,
        type TeamRole,
    } from "$lib/team";
    import { uiPreferences } from "$lib/uiPreferences";
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
    import TeamMemberCreateDialog from "./TeamMemberCreateDialog.svelte";
    import {
        TEAM_ACCOUNT_STATES,
        TEAM_ORDERING_FIELDS,
        TEAM_TABLE_SETTINGS,
        getTeamRows,
        isLoading,
        serverItemCount,
        setupTable,
        type TeamMemberRow,
    } from "./createTable";

    type RoleFilterOption = {
        value: string | number;
        name: string;
        icon: string;
        iconColor: string;
        isSuperuser?: boolean;
    };
    const STATUS_FILTER_OPTIONS = [
        { value: "active", name: "Actifs", icon: "CircleCheck", color: "--green" },
        { value: "inactive", name: "Désactivés", icon: "CircleOff", color: "--red" },
    ] as const;

    const WIDTH_STORAGE_KEY = "team.table.columnWidths.v1";

    let viewModel = $state<TableViewModel<TeamMemberRow> | null>(null);
    let headerRows: Readable<HeaderRow<TeamMemberRow>[]> = writable([]);
    let tableAttrs: Readable<Record<string, unknown>> = writable({});
    let tableBodyAttrs: Readable<Record<string, unknown>> = writable({});
    let pageRows: Readable<BodyRow<TeamMemberRow, AnyPlugins>[]> = writable([]);

    let filterValue: Writable<string> = writable("");
    let pageIndex: Writable<number> = writable(0);
    let pageCount: Writable<number> = writable(0);
    let pageSize: Writable<number> = writable(15);
    let hasNextPage: Writable<boolean> = writable(false);
    let hasPreviousPage: Writable<boolean> = writable(false);
    let columnWidths: Writable<Record<string, number>> = writable({});
    let sortKeys: Writable<TableSortKey[]> = writable([]);
    let data: Writable<TeamMemberRow[]> = writable([]);

    let roles = $state<TeamRole[]>([]);
    let roleFilter = $state<string | number>("all");
    let statusFilter = $state("all");
    let rolePopoverOpen = $state(false);
    let statusPopoverOpen = $state(false);
    let configLoading = $state(true);
    let loadError = $state("");
    let createOpen = $state(false);
    let minPasswordLength = $state(8);
    let requestSerial = 0;
    let searchTimeout: ReturnType<typeof setTimeout> | undefined;
    let suppressSearchReload = false;
    let unsubscribers: Array<() => void> = [];

    const can = (key: string) => Boolean($currentUser?.administrator || $currentUser?.permissions?.includes(key));
    const canAny = (keys: readonly string[]) => keys.some(can);
    const canOpenMember = $derived(canAny(TEAM_DETAIL_PERMISSIONS));
    const roleFilterOptions: RoleFilterOption[] = $derived([
        {
            value: "superuser",
            name: "Super-administrateur",
            icon: "",
            iconColor: "--user-color",
            isSuperuser: true,
        },
        ...roles.map((role) => ({
            name: role.name?.trim() || "Rôle sans nom",
            value: role.id,
            icon: role.icon || "Shield",
            iconColor: role.iconColor,
        })),
    ]);
    const activeRoleFilter = $derived(
        roleFilterOptions.find((role) => String(role.value) === String(roleFilter)),
    );
    const hasFacetFilters = $derived(roleFilter !== "all" || statusFilter !== "all");

    const hasActiveFilters = () => Boolean(get(filterValue).trim() || roleFilter !== "all" || statusFilter !== "all");

    function buildQuery() {
        const query: Record<string, string | number | undefined> = {
            search: get(filterValue).trim(),
            role: roleFilter,
            status: statusFilter,
        };
        const first = get(sortKeys)?.[0];
        if (!first?.id || !first.order) return query;

        const setting = TEAM_TABLE_SETTINGS.find((item) => String(item.id) === String(first.id));
        const ordering = setting?.dataOrigin ? TEAM_ORDERING_FIELDS[setting.dataOrigin] : undefined;
        if (ordering) query.ordering = `${first.order === "desc" ? "-" : ""}${ordering}`;
        return query;
    }

    function readColumnWidths(): Record<string, number> {
        if (typeof localStorage === "undefined") return {};
        try {
            const value = JSON.parse(localStorage.getItem(WIDTH_STORAGE_KEY) || "{}");
            if (!value || typeof value !== "object" || Array.isArray(value)) return {};
            const widths: Record<string, number> = {};
            for (const [key, width] of Object.entries(value)) {
                if (typeof width === "number" && Number.isFinite(width) && width >= 80 && width <= 1200) widths[key] = width;
            }
            return widths;
        } catch {
            return {};
        }
    }

    async function fetchPage(pageNumber: number) {
        const serial = ++requestSerial;
        const result = await getTeamRows(pageNumber, get(pageSize), buildQuery());
        return serial === requestSerial ? result : null;
    }

    async function refreshData(pageNumber = get(pageIndex) + 1) {
        loadError = "";
        try {
            const result = await fetchPage(pageNumber);
            if (!result) return;
            serverItemCount.set(result.count);
            data.set(result.rows);
        } catch (error) {
            console.error("Failed to load team members", error);
            loadError = "Impossible de charger les utilisateurs.";
        }
    }

    async function refreshFirstPage() {
        if (get(pageIndex) !== 0) pageIndex.set(0);
        else await refreshData(1);
    }

    async function resetFilters() {
        clearTimeout(searchTimeout);
        suppressSearchReload = true;
        filterValue.set("");
        suppressSearchReload = false;
        rolePopoverOpen = false;
        statusPopoverOpen = false;
        roleFilter = "all";
        statusFilter = "all";
        await refreshFirstPage();
    }

    async function setRoleFilter(value: string | number) {
        roleFilter = String(roleFilter) === String(value) ? "all" : value;
        rolePopoverOpen = false;
        await refreshFirstPage();
    }

    async function clearRoleFilter() {
        roleFilter = "all";
        rolePopoverOpen = false;
        await refreshFirstPage();
    }

    async function clearStatusFilter() {
        statusFilter = "all";
        statusPopoverOpen = false;
        await refreshFirstPage();
    }

    async function setStatusFilter(value: "active" | "inactive") {
        statusFilter = statusFilter === value ? "all" : value;
        statusPopoverOpen = false;
        await refreshFirstPage();
    }

    async function clearFacetFilters() {
        roleFilter = "all";
        statusFilter = "all";
        rolePopoverOpen = false;
        statusPopoverOpen = false;
        await refreshFirstPage();
    }

    async function initialiseTable() {
        configLoading = true;
        loadError = "";
        viewModel = null;
        requestSerial += 1;
        clearTimeout(searchTimeout);
        unsubscribers.forEach((unsubscribe) => unsubscribe());
        unsubscribers = [];

        let subscriptionsReady = false;
        try {
            const initialPageSize = readTablePageSize("team");
            pageSize = writable(initialPageSize);
            const sortableColumnIds = TEAM_TABLE_SETTINGS
                .filter((setting) => setting.dataOrigin && setting.dataOrigin in TEAM_ORDERING_FIELDS)
                .map((setting) => setting.id);
            const storedOrdering = readTableOrdering("team", sortableColumnIds);
            const initialSortKeys = storedOrdering ? [storedOrdering] : [];
            sortKeys = writable(initialSortKeys);
            const [loadedRoles, settings] = await Promise.all([
                canAny(["users.invite", "users.modify", "roles.manage"])
                    ? getAssignableRoles().catch((error) => {
                          console.error("Failed to load assignable roles", error);
                          return [];
                      })
                    : Promise.resolve([]),
                bootstrapSettings().catch(() => null),
            ]);
            roles = loadedRoles;
            minPasswordLength = Number(settings?.value.team.minPasswordLength) || 8;

            const initial = await fetchPage(1);
            if (!initial) return;
            serverItemCount.set(initial.count);

            const tableConfig = setupTable(initial.rows, readColumnWidths(), initialPageSize, initialSortKeys);
            data = tableConfig.data;
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
                        try {
                            localStorage.setItem(WIDTH_STORAGE_KEY, JSON.stringify(widths));
                        } catch (error) {
                            console.warn("Unable to persist team column widths", error);
                        }
                    }),
                );
            }

            unsubscribers.push(
                pageIndex.subscribe((nextPageIndex) => {
                    if (subscriptionsReady) void refreshData(nextPageIndex + 1);
                }),
                pageSize.subscribe((nextPageSize) => {
                    persistTablePageSize("team", nextPageSize);
                    if (!subscriptionsReady) return;
                    if (get(pageIndex) !== 0) pageIndex.set(0);
                    else void refreshData(1);
                }),
                filterValue.subscribe(() => {
                    if (!subscriptionsReady || suppressSearchReload) return;
                    clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(() => void refreshFirstPage(), 300);
                }),
                sortKeys.subscribe((nextSortKeys) => {
                    if (!subscriptionsReady) return;
                    persistTableOrdering("team", nextSortKeys[0] ?? null, sortableColumnIds);
                    void refreshFirstPage();
                }),
            );

            subscriptionsReady = true;
        } catch (error) {
            console.error("Failed to initialise team table", error);
            loadError = "Impossible de charger les utilisateurs.";
        } finally {
            configLoading = false;
        }
    }

    onMount(() => void initialiseTable());
    onDestroy(() => {
        requestSerial += 1;
        clearTimeout(searchTimeout);
        unsubscribers.forEach((unsubscribe) => unsubscribe());
    });
</script>

<div class="flex h-full w-full flex-col overflow-hidden">
    <div class="flex h-14 min-h-14 shrink-0 items-center justify-between border-b border-(--light-bg3) bg-(--light-bg1) px-6">
        <div class="min-w-0">
            <h1 class="truncate text-lg font-bold text-(--dark-bg1)">Équipe</h1>
        </div>

        <div class="flex items-center gap-2">
            {#if can("roles.manage")}
                <Button variant="secondary" size="sm" icon="Shield" label="Rôles" class="w-fit" onclick={() => goto("/settings/team")} />
            {/if}
            {#if can("users.invite")}
                <Button
                    icon="Plus"
                    label="Nouvel utilisateur"
                    class="w-fit"
                    disabled={roles.length === 0}
                    tooltip={roles.length ? undefined : "Aucun rôle délégable n’est disponible."}
                    onclick={() => (createOpen = true)}
                />
            {/if}
        </div>
    </div>

    {#if !configLoading && loadError}
        <section class="flex min-h-0 flex-1 items-center justify-center px-6 py-5">
            <div class="flex max-w-sm flex-col items-center gap-3 text-center">
                <div class="flex size-10 items-center justify-center rounded-xl border border-(--light-bg3) bg-(--light-bg1) text-(--red)">
                    <Icon.AlertCircle size={18} />
                </div>
                <div>
                    <p class="text-sm font-semibold text-(--dark-bg1)">{loadError}</p>
                    <p class="mt-1 text-xs leading-5 text-(--grey)">Vérifiez la connexion au serveur puis réessayez.</p>
                </div>
                <Button variant="secondary" size="sm" icon="RefreshCw" label="Réessayer" class="w-fit" onclick={initialiseTable} />
            </div>
        </section>
    {:else if !configLoading && viewModel}
        <section class="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-6 py-5">
            <div class="flex shrink-0 flex-wrap items-center justify-between gap-3">
                <div class="flex h-8 min-w-0 flex-1 items-center gap-2">
                    <div class="h-8 w-full max-w-96 min-w-56">
                        <TextInput
                            name="team-search"
                            placeholder="Rechercher un utilisateur"
                            icon="Search"
                            iconSide="left"
                            bind:value={$filterValue}
                        />
                    </div>

                    <Popover.Root bind:open={rolePopoverOpen}>
                        <Popover.Trigger>
                            {#snippet child({ props })}
                                <Button
                                    {...props}
                                    variant={roleFilter !== "all" ? "primary" : "secondary"}
                                    size="sm"
                                    icon="Shield"
                                    class="w-fit"
                                >
                                    <span>Rôle</span>
                                    {#if roleFilter !== "all"}
                                        <span class="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-white/20 px-1 text-[10px] font-bold tabular-nums">
                                            1
                                        </span>
                                    {/if}
                                </Button>
                            {/snippet}
                        </Popover.Trigger>

                        <MyPopover class="min-w-52 max-w-[calc(100vw-3rem)] items-stretch rounded-lg p-1" align="start">
                            <div class="flex max-h-80 w-full flex-col gap-0.5 overflow-y-auto">
                                {#each roleFilterOptions as role (role.value)}
                                    {@const selected = String(roleFilter) === String(role.value)}
                                    {@const roleColor = cssColor(role.iconColor)}
                                    <button
                                        type="button"
                                        class={`flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left transition-colors hover:bg-[color-mix(in_oklab,var(--role-color)_10%,transparent)] ${selected ? "bg-(--light-bg2)" : "text-(--dark-bg1)"}`}
                                        style={`--role-color:${roleColor ?? "var(--grey)"}`}
                                        onclick={() => setRoleFilter(role.value)}
                                    >
                                        {#if role.icon}
                                            <LucideIcon
                                                size={14}
                                                name={role.icon as any}
                                                class="shrink-0"
                                                style={roleColor ? `color:${roleColor}` : undefined}
                                            />
                                        {/if}
                                        <span
                                            class="min-w-0 flex-1 truncate text-xs font-medium"
                                            style={role.isSuperuser && roleColor ? `color:${roleColor}` : undefined}
                                        >
                                            {role.name}
                                        </span>
                                        {#if selected}
                                            <Icon.Check size={13} class="shrink-0 text-(--green)" />
                                        {/if}
                                    </button>
                                {/each}
                            </div>
                        </MyPopover>
                    </Popover.Root>

                    <Popover.Root bind:open={statusPopoverOpen}>
                        <Popover.Trigger>
                            {#snippet child({ props })}
                                <Button
                                    {...props}
                                    variant={statusFilter !== "all" ? "primary" : "secondary"}
                                    size="sm"
                                    icon="CircleDot"
                                    class="w-fit"
                                >
                                    <span>État</span>
                                    {#if statusFilter !== "all"}
                                        <span class="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-white/20 px-1 text-[10px] font-bold tabular-nums">
                                            1
                                        </span>
                                    {/if}
                                </Button>
                            {/snippet}
                        </Popover.Trigger>

                        <MyPopover class="min-w-52 max-w-[calc(100vw-3rem)] items-stretch rounded-lg p-1" align="start">
                            <div class="flex max-h-80 w-full flex-col gap-0.5 overflow-y-auto">
                                {#each STATUS_FILTER_OPTIONS as state (state.value)}
                                    {@const selected = statusFilter === state.value}
                                    {@const stateColor = cssColor(state.color)}
                                    <button
                                        type="button"
                                        class={`flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left transition-colors hover:bg-[color-mix(in_oklab,var(--status-color)_10%,transparent)] ${selected ? "bg-(--light-bg2)" : "text-(--dark-bg1)"}`}
                                        style={`--status-color:${stateColor ?? "var(--grey)"}`}
                                        onclick={() => setStatusFilter(state.value)}
                                    >
                                        <LucideIcon
                                            size={14}
                                            name={state.icon}
                                            class="shrink-0"
                                            style={stateColor ? `color:${stateColor}` : undefined}
                                        />
                                        <span class="min-w-0 flex-1 truncate text-xs font-medium text-(--dark-bg1)">{state.name}</span>
                                        {#if selected}
                                            <Icon.Check size={13} class="shrink-0 text-(--green)" />
                                        {/if}
                                    </button>
                                {/each}
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
                        {$serverItemCount} utilisateur{$serverItemCount !== 1 ? "s" : ""}
                    {/if}
                </div>
            </div>

            {#if hasFacetFilters}
                <div class="flex shrink-0 flex-wrap items-center gap-2">
                    {#if roleFilter !== "all" && activeRoleFilter}
                        <span class="inline-flex max-w-80 items-center gap-1 rounded-lg border border-(--light-bg3) bg-(--light-bg1) p-1 pl-2 text-xs font-normal text-(--dark-bg1)">
                            <span>Rôle</span>
                            <DisplayValue
                                value={{
                                    name: activeRoleFilter.name,
                                    icon: activeRoleFilter.icon,
                                    iconColor: activeRoleFilter.iconColor,
                                    isSuperuser: activeRoleFilter.isSuperuser,
                                }}
                                display="role"
                                class="max-w-52"
                            />
                            <Button
                                variant="ghost"
                                size="xs"
                                icon="X"
                                class="px-1 text-(--grey) transition-colors hover:text-(--red)"
                                onclick={clearRoleFilter}
                            />
                        </span>
                    {/if}

                    {#if statusFilter !== "all"}
                        <span class="inline-flex max-w-80 items-center gap-1 rounded-lg border border-(--light-bg3) bg-(--light-bg1) p-1 pl-2 text-xs font-normal text-(--dark-bg1)">
                            <span>État</span>
                            <StateBadge
                                state={statusFilter === "active" ? "active" : "inactive"}
                                states={TEAM_ACCOUNT_STATES}
                                class="max-w-52 rounded-full px-2 py-0.5 text-xs font-normal"
                            />
                            <Button
                                variant="ghost"
                                size="xs"
                                icon="X"
                                class="px-1 text-(--grey) transition-colors hover:text-(--red)"
                                onclick={clearStatusFilter}
                            />
                        </span>
                    {/if}

                    <Button
                        variant="ghost"
                        size="xs"
                        icon="X"
                        label="Tout effacer"
                        class="w-fit text-(--grey) hover:text-(--red)"
                        onclick={clearFacetFilters}
                    />
                </div>
            {/if}

            <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-(--light-bg3) bg-(--light-bg1)">
                <div class="min-h-0 flex-1 overflow-auto">
                    <div class="flex min-h-full min-w-fit flex-col bg-(--light-bg1)" {...$tableAttrs} aria-label="Liste des utilisateurs">
                        <div class="sticky top-0 z-20 w-full">
                            {#each $headerRows as headerRow (headerRow.id)}
                                <Subscribe rowAttrs={headerRow.attrs()} let:rowAttrs>
                                    <div class="flex min-w-fit items-stretch border-b border-(--light-bg3) bg-(--light-bg2)" {...rowAttrs}>
                                        {#each headerRow.cells as cell, cellIndex (cell.id)}
                                            <Subscribe attrs={cell.attrs()} let:attrs props={cell.props()} let:props>
                                                {@const pluginProps = props as {
                                                    sort: { toggle: () => void; order?: "asc" | "desc"; disabled: boolean };
                                                    resize: { disabled: boolean; drag: (node: HTMLElement) => void; reset: (node: HTMLElement) => void };
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
                                                        class={`h-auto min-w-0 flex-1 justify-start gap-1 rounded-md px-0 py-0 text-left text-xs font-medium uppercase tracking-wider hover:bg-transparent hover:text-(--dark-bg1) disabled:cursor-default ${sort.order ? "text-(--dark-bg1)" : "text-(--grey)"}`}
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
                                    {@const row = rowRaw as DataBodyRow<TeamMemberRow, AnyPlugins>}
                                    <Subscribe rowAttrs={row.attrs()} let:rowAttrs>
                                        <svelte:element
                                            this={canOpenMember ? "a" : "div"}
                                            href={canOpenMember ? `/team/${row.original.id}` : undefined}
                                            aria-label={canOpenMember ? `Ouvrir ${memberDisplayName(row.original)}` : undefined}
                                            class={`data-table-row group flex min-w-fit items-stretch border-b last:border-b-0 border-(--light-bg3) text-sm no-underline transition-colors duration-(--animation-duration-150) ${canOpenMember ? "hover:bg-(--light-bg2) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--user-color)" : ""} ${rowHeightClasses[$uiPreferences.density]}`}
                                            {...rowAttrs}
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
                                        </svelte:element>
                                    </Subscribe>
                                {/each}
                            {:else if hasActiveFilters()}
                                <div class="flex min-h-72 min-w-full flex-col items-center justify-center gap-3 px-8 text-center">
                                    <div class="flex size-10 items-center justify-center rounded-xl border border-(--light-bg3) bg-(--light-bg2) text-(--grey)">
                                        <Icon.SearchX size={18} />
                                    </div>
                                    <div>
                                        <p class="text-sm font-semibold text-(--dark-bg1)">Aucun utilisateur</p>
                                        <p class="mt-1 text-xs leading-5 text-(--grey)">Aucun compte ne correspond à la recherche ou aux filtres actifs.</p>
                                    </div>
                                    <Button variant="secondary" size="sm" label="Réinitialiser" class="w-fit" onclick={resetFilters} />
                                </div>
                            {:else}
                                <div class="flex min-h-72 min-w-full items-center justify-center px-8 text-sm text-(--grey)">Aucun utilisateur.</div>
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
                        <Button variant="ghost" size="sm" icon="ChevronsLeft" title="Première page" aria-label="Première page" class="size-8 px-0 hover:bg-(--light-bg3) disabled:cursor-not-allowed disabled:opacity-30" disabled={!$hasPreviousPage} onclick={() => pageIndex.set(0)} />
                        <Button variant="ghost" size="sm" icon="ChevronLeft" title="Page précédente" aria-label="Page précédente" class="size-8 px-0 hover:bg-(--light-bg3) disabled:cursor-not-allowed disabled:opacity-30" disabled={!$hasPreviousPage} onclick={() => pageIndex.set($pageIndex - 1)} />

                        <div class="hidden items-center gap-1 sm:flex">
                            {#each visiblePages($pageIndex, $pageCount) as visiblePage, visibleIndex}
                                {#if visibleIndex > 0 && visiblePage - visiblePages($pageIndex, $pageCount)[visibleIndex - 1] > 1}
                                    <span class="flex size-8 items-center justify-center text-xs text-(--grey)">...</span>
                                {/if}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    label={String(visiblePage + 1)}
                                    aria-label={`Page ${visiblePage + 1}`}
                                    class={`size-8 px-0 text-xs ${$pageIndex === visiblePage ? "bg-(--user-color) text-white hover:bg-(--user-color-darker)" : "text-(--dark-bg1) hover:bg-(--light-bg3)"}`}
                                    onclick={() => pageIndex.set(visiblePage)}
                                />
                            {/each}
                        </div>

                        <Button variant="ghost" size="sm" icon="ChevronRight" title="Page suivante" aria-label="Page suivante" class="size-8 px-0 hover:bg-(--light-bg3) disabled:cursor-not-allowed disabled:opacity-30" disabled={!$hasNextPage} onclick={() => pageIndex.set($pageIndex + 1)} />
                        <Button variant="ghost" size="sm" icon="ChevronsRight" title="Dernière page" aria-label="Dernière page" class="size-8 px-0 hover:bg-(--light-bg3) disabled:cursor-not-allowed disabled:opacity-30" disabled={!$hasNextPage} onclick={() => pageIndex.set(Math.max($pageCount - 1, 0))} />
                    </div>

                    <div class="flex min-w-44 items-center justify-end gap-2 text-xs font-medium text-(--dark-bg1)">
                        <span>Afficher</span>
                        <div class="w-20">
                            <Select
                                name="team-page-size"
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
            Chargement de l’équipe...
        </section>
    {/if}
</div>

<TeamMemberCreateDialog
    bind:open={createOpen}
    {roles}
    {minPasswordLength}
    onCreated={async (user) => {
        if (canOpenMember) await goto(`/team/${user.id}`);
        else await refreshFirstPage();
    }}
/>
