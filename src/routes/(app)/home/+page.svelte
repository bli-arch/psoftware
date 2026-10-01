<script lang="ts">
    import { goto } from "$app/navigation";
    import { apiGet } from "$lib/api";
    import { currentUser } from "$lib/auth";
    import { StateBadge } from "$lib/components/Badge";
    import LucideIcon from "$lib/components/Badge/LucideIcon.svelte";
    import { Button } from "$lib/components/istyler";
    import { normalizeFormConfig, recordList } from "$lib/formConfig";
    import {
        operationPlural,
        operationPluralLower,
        operationSingularLower,
    } from "$lib/operationDisplay";
    import { appSettings } from "$lib/settings";
    import { workspaceSetup } from "$lib/system";
    import { strftime } from "$lib/utils";
    import * as Icon from "lucide-svelte";
    import { onMount } from "svelte";
    import ClientForm from "../clients/ClientForm.svelte";
    import OperationForm from "../operations/OperationForm.svelte";
    import {
        buildClientIdentityFields,
        buildFieldLabelMap,
        getClientInitials,
        getClientName,
        getClientSecondaryName,
        type ClientIdentityFields,
    } from "../operations/operationUtils";
    import HomeSetupBanner from "./HomeSetupBanner.svelte";
    import HomeStatistics from "./HomeStatistics.svelte";

    type DashboardClient = {
        id: number;
        uid: string;
        data: Record<string, unknown>;
        created_at: string;
    };

    type DashboardOperation = {
        id: number;
        uid: string;
        state: number;
        client: DashboardClient | null;
        created_at: string;
    };

    type DashboardState = {
        id: number;
        name: string;
        count: number;
        settings: Record<string, unknown>;
    };

    type DashboardPeriodMetric = {
        current: number;
        previous: number;
        days: number;
    };

    type DashboardData = {
        operations: {
            total: number;
            states: DashboardState[];
            recent: DashboardOperation[];
        } | null;
        clients: {
            total: number;
            recent: DashboardClient[];
        } | null;
        statistics: {
            scope: "personal" | "global";
            operations: DashboardPeriodMetric | null;
            clients: DashboardPeriodMetric | null;
            documents: DashboardPeriodMetric | null;
        };
    };

    let dashboard = $state<DashboardData | null>(null);
    let clientLabels = $state<Record<string, string>>({});
    let clientIdentityFields = $state<ClientIdentityFields>({});
    let loading = $state(true);
    let loadError = $state("");

    const can = (permission: string) =>
        Boolean($currentUser?.administrator || $currentUser?.permissions?.includes(permission));

    const canCreateClient = $derived(
        can("clients.create")
        && $workspaceSetup?.clientForm === true
        && $workspaceSetup?.clientColumns === true
        && $workspaceSetup?.clientIdentifier === true,
    );
    const canCreateOperation = $derived(
        can("operations.create")
        && $workspaceSetup?.operationForm === true
        && $workspaceSetup?.operationColumns === true
        && $workspaceSetup?.operationIdentifier === true
        && $workspaceSetup?.operationStatuses === true
        && (can("clients.view_list") || can("clients.create")),
    );
    const statisticItems = $derived([
        dashboard?.statistics.operations
            ? {
                label: operationPlural($appSettings.value.operation),
                icon: $appSettings.value.operation.operationIcon || "BriefcaseBusiness",
                ...dashboard.statistics.operations,
                href: "/operations",
            }
            : null,
        dashboard?.statistics.clients
            ? { label: "Clients ajoutés", icon: "UserPlus", ...dashboard.statistics.clients, href: "/clients" }
            : null,
    ].filter((item) => item !== null));

    function normalizeMetric(value: any): DashboardPeriodMetric | null {
        if (!value) return null;
        return {
            current: Number(value.current) || 0,
            previous: Number(value.previous) || 0,
            days: Number(value.days) || 0,
        };
    }

    async function loadDashboard() {
        loading = true;
        loadError = "";

        try {
            const [summary, clientForm] = await Promise.all([
                apiGet("/core/dashboard/"),
                can("clients.view_list") || can("operations.view_details")
                    ? apiGet("/settings/form/active/client").catch((error: unknown) => {
                        if ((error as { status?: number })?.status === 404) return null;
                        throw error;
                    })
                    : Promise.resolve(null),
            ]);

            dashboard = {
                operations: summary?.operations
                    ? {
                        total: Number(summary.operations.total) || 0,
                        states: recordList(summary.operations.states) as DashboardState[],
                        recent: recordList(summary.operations.recent) as DashboardOperation[],
                    }
                    : null,
                clients: summary?.clients
                    ? {
                        total: Number(summary.clients.total) || 0,
                        recent: recordList(summary.clients.recent) as DashboardClient[],
                    }
                    : null,
                statistics: {
                    scope: summary?.statistics?.scope === "global" ? "global" : "personal",
                    operations: normalizeMetric(summary?.statistics?.operations),
                    clients: normalizeMetric(summary?.statistics?.clients),
                    documents: normalizeMetric(summary?.statistics?.documents),
                },
            };

            const config = normalizeFormConfig(clientForm);
            const labels = buildFieldLabelMap(config?.form.pages ?? []);
            clientLabels = { ...labels.data, ...labels.client };
            clientIdentityFields = buildClientIdentityFields(config?.form.pages ?? []);
        } catch (error) {
            console.error("Failed to load dashboard", error);
            loadError = "Impossible de charger le tableau de bord.";
        } finally {
            loading = false;
        }
    }

    onMount(() => {
        void loadDashboard();
    });
</script>

<div class="flex min-h-0 w-full flex-1 flex-col overflow-hidden font-(family-name:--font) text-(--dark-bg1)">
    <header class="flex h-14 min-h-14 shrink-0 items-center border-b border-(--light-bg3) bg-(--light-bg1) px-6">
        <h1 class="min-w-0 truncate text-lg font-bold">Accueil</h1>
    </header>

    <div class="min-h-0 flex-1 overflow-y-auto">
        <HomeSetupBanner />

        <main class="flex w-full max-w-full flex-col gap-5 px-6 py-5">
            <section class="flex flex-col gap-4 border-b border-(--light-bg3) pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div class="min-w-0">
                    <h2 class="text-xl font-bold leading-tight">
                        {$currentUser?.username ? `Bienvenue, ${$currentUser.username}` : "Bienvenue"}
                    </h2>
                    <p class="mt-1 max-w-2xl text-sm leading-6 text-(--grey)">
                        Retrouvez vos dernières activités ou commencez une nouvelle saisie.
                    </p>
                </div>

                {#if canCreateClient || canCreateOperation}
                    <div class="flex shrink-0 flex-wrap gap-2">
                        {#if canCreateClient}
                            <ClientForm onCreated={() => void loadDashboard()}>
                                {#snippet children(builder)}
                                    <Button
                                        {builder}
                                        variant="secondary"
                                        size="sm"
                                        icon="UserPlus"
                                        label="Nouveau client"
                                        class="w-fit"
                                    />
                                {/snippet}
                            </ClientForm>
                        {/if}

                        {#if canCreateOperation}
                            <OperationForm direction="right" onCreated={() => void loadDashboard()}>
                                {#snippet children(builder)}
                                    <Button
                                        {builder}
                                        variant="secondary"
                                        size="sm"
                                        icon={$appSettings.value.operation.operationIcon || "BriefcaseBusiness"}
                                        label={`Nouvelle ${operationSingularLower($appSettings.value.operation)}`}
                                        class="w-fit"
                                    />
                                {/snippet}
                            </OperationForm>
                        {/if}
                    </div>
                {/if}
            </section>

            {#if loading}
                <div class="flex min-h-52 items-center justify-center gap-2 text-sm text-(--grey)" role="status">
                    <Icon.Loader2 size={16} class="ui-loader-spin" />
                    Chargement du tableau de bord...
                </div>
            {:else if loadError}
                <section class="flex min-h-52 items-center justify-center rounded-xl border border-(--light-bg3) bg-(--light-bg1) px-6">
                    <div class="flex max-w-sm flex-col items-center text-center">
                        <Icon.AlertCircle size={20} class="text-(--red)" />
                        <p class="mt-3 text-sm font-semibold">{loadError}</p>
                        <Button
                            variant="secondary"
                            size="sm"
                            icon="RefreshCw"
                            label="Réessayer"
                            class="mt-4 w-fit"
                            onclick={loadDashboard}
                        />
                    </div>
                </section>
            {:else if dashboard}
                <HomeStatistics scope={dashboard.statistics.scope} items={statisticItems} />

                <div class={`grid grid-cols-1 items-start gap-5 ${dashboard.operations ? "xl:grid-cols-[minmax(16rem,0.8fr)_minmax(0,2fr)]" : ""}`}>
                    {#if dashboard.operations}
                        <div class="flex min-w-0 flex-col gap-5">
                                <section class="overflow-hidden rounded-xl border border-(--light-bg3) bg-(--light-bg1)">
                                    <div class="flex min-h-11 items-center justify-between gap-3 border-b border-(--light-bg3) px-4 py-2.5">
                                        <div class="min-w-0">
                                            <h2 class="truncate text-sm font-bold">
                                                {dashboard.statistics.scope === "global" ? "Suivi des" : "Vos"}
                                                {operationPluralLower($appSettings.value.operation)}
                                            </h2>
                                            <p class="mt-0.5 truncate text-xs text-(--grey)">Répartition par statut</p>
                                        </div>
                                        <span class="shrink-0 text-xs font-semibold text-(--grey)">
                                            {dashboard.statistics.scope === "global" ? "Total" : "Personnel"} :
                                            {dashboard.operations.total}
                                        </span>
                                    </div>

                                    {#if dashboard.operations.states.length}
                                        <div>
                                            {#each dashboard.operations.states as state (state.id)}
                                                <svelte:element
                                                    this={dashboard.statistics.scope === "global" ? "a" : "div"}
                                                    href={dashboard.statistics.scope === "global" ? `/operations?status=${encodeURIComponent(state.name)}` : undefined}
                                                    class={`group flex min-h-14 items-center justify-between gap-3 border-b border-(--light-bg3) px-4 py-2.5 text-inherit no-underline outline-none last:border-b-0 ${dashboard.statistics.scope === "global" ? "transition-colors duration-(--animation-duration-150) hover:bg-(--light-bg2) focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--user-color)" : ""}`}
                                                    aria-label={dashboard.statistics.scope === "global" ? `Voir les ${operationPluralLower($appSettings.value.operation)} au statut ${state.name}` : undefined}
                                                >
                                                    <StateBadge
                                                        state={state.id}
                                                        states={dashboard.operations.states}
                                                        class="min-w-0 max-w-full text-xs"
                                                    />
                                                    <span class="flex shrink-0 items-center gap-2">
                                                        <strong class="text-lg leading-none tabular-nums">{state.count}</strong>
                                                        {#if dashboard.statistics.scope === "global"}
                                                            <Icon.ChevronRight size={14} class="text-(--grey) transition-transform duration-(--animation-duration-150) group-hover:translate-x-0.5" />
                                                        {/if}
                                                    </span>
                                                </svelte:element>
                                            {/each}
                                        </div>
                                    {:else}
                                        <p class="px-4 py-6 text-center text-sm text-(--grey)">Aucun statut configuré.</p>
                                    {/if}
                                </section>

                        </div>
                    {/if}

                    <div class="flex min-w-0 flex-col gap-5">
                        {#if dashboard.operations}
                            <section class="overflow-hidden rounded-xl border border-(--light-bg3) bg-(--light-bg1)">
                                <div class="flex h-11 items-center justify-between gap-4 border-b border-(--light-bg3) px-4">
                                    <h2 class="text-sm font-bold">
                                        {dashboard.statistics.scope === "personal"
                                            ? `Vos ${operationPluralLower($appSettings.value.operation)} récentes`
                                            : `${operationPlural($appSettings.value.operation)} récentes`}
                                    </h2>
                                    <Button
                                        variant="ghost"
                                        size="xs"
                                        label="Voir tout"
                                        class="w-fit shrink-0 bg-transparent px-0 text-(--grey) hover:bg-transparent hover:text-(--dark-bg1) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--user-color)"
                                        onclick={() => void goto("/operations")}
                                    />
                                </div>

                                {#if dashboard.operations.recent.length}
                                    <div>
                                        {#each dashboard.operations.recent as operation (operation.id)}
                                            <a
                                                href={`/operations/${encodeURIComponent(operation.uid)}`}
                                                class="grid min-h-15 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-(--light-bg3) px-4 py-2.5 text-inherit no-underline transition-colors duration-(--animation-duration-150) last:border-b-0 hover:bg-(--light-bg2) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--user-color)"
                                            >
                                                <span class="flex min-w-0 items-center gap-3">
                                                    <LucideIcon
                                                        name={$appSettings.value.operation.operationIcon as any}
                                                        size={16}
                                                        class="shrink-0 text-(--user-color)"
                                                    />
                                                    <span class="min-w-0">
                                                        <span class="block truncate text-sm font-semibold">{operation.uid}</span>
                                                        <span class="mt-0.5 block truncate text-xs text-(--grey)">
                                                            {operation.client ? getClientName(operation.client, clientLabels, clientIdentityFields) : "Client indisponible"}
                                                        </span>
                                                    </span>
                                                </span>

                                                <span class="flex min-w-0 items-center gap-4">
                                                    <StateBadge
                                                        state={operation.state}
                                                        states={dashboard.operations.states}
                                                        class="max-w-36 text-xs font-semibold"
                                                    />
                                                    <time
                                                        datetime={operation.created_at}
                                                        class="hidden w-24 text-right text-xs text-(--grey) sm:block"
                                                    >
                                                        {strftime(operation.created_at, "%d %_b %H:%M", "fr-FR")}
                                                    </time>
                                                </span>
                                            </a>
                                        {/each}
                                    </div>
                                {:else}
                                    <p class="px-4 py-8 text-center text-sm text-(--grey)">
                                        Aucune {operationSingularLower($appSettings.value.operation)} pour le moment.
                                    </p>
                                {/if}
                            </section>
                        {/if}
                        {#if dashboard.clients}
                            <section class="overflow-hidden rounded-xl border border-(--light-bg3) bg-(--light-bg1)">
                                <div class="flex h-11 items-center justify-between gap-4 border-b border-(--light-bg3) px-4">
                                    <h2 class="text-sm font-bold">
                                        {dashboard.statistics.scope === "personal" ? "Vos clients récents" : "Clients récents"}
                                    </h2>
                                    <Button
                                        variant="ghost"
                                        size="xs"
                                        label="Voir tout"
                                        class="w-fit shrink-0 bg-transparent px-0 text-(--grey) hover:bg-transparent hover:text-(--dark-bg1) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--user-color)"
                                        onclick={() => void goto("/clients")}
                                    />
                                </div>

                                {#if dashboard.clients.recent.length}
                                    <div class="flex flex-col gap-1.5 p-2">
                                        {#each dashboard.clients.recent as client (client.id)}
                                            <svelte:element
                                                this={can("clients.view_details") ? "a" : "div"}
                                                href={can("clients.view_details") ? `/clients/${encodeURIComponent(client.uid)}` : undefined}
                                                class={`flex w-full items-center gap-3 rounded-lg border border-transparent bg-transparent px-3.5 py-2.5 text-left text-inherit no-underline transition-colors duration-(--animation-duration-150) ${can("clients.view_details") ? "cursor-pointer hover:border-(--light-bg3) hover:bg-(--light-bg2) focus-visible:outline-2 focus-visible:outline-(--user-color)" : ""}`}
                                            >
                                                <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-(--user-color)/10 text-xs font-semibold text-(--user-color)">
                                                    {getClientInitials(client, clientLabels, clientIdentityFields)}
                                                </span>
                                                <span class="min-w-0 flex-1">
                                                    <span class="mb-0.5 block truncate text-sm font-medium text-(--dark-bg1)">{getClientName(client, clientLabels, clientIdentityFields)}</span>
                                                    {#if getClientSecondaryName(client, clientIdentityFields)}
                                                        <span class="block truncate text-xs text-(--dark-bg1)/70">{getClientSecondaryName(client, clientIdentityFields)}</span>
                                                    {/if}
                                                    <span class="block truncate text-xs text-(--grey)">{client.uid}</span>
                                                </span>
                                                <time
                                                    datetime={client.created_at}
                                                    class="hidden w-24 shrink-0 text-right text-xs text-(--grey) sm:block"
                                                >
                                                    {strftime(client.created_at, "%d %_b %H:%M", "fr-FR")}
                                                </time>
                                            </svelte:element>
                                        {/each}
                                    </div>
                                {:else}
                                    <p class="px-4 py-8 text-center text-sm text-(--grey)">Aucun client pour le moment.</p>
                                {/if}

                                <div class="border-t border-(--light-bg3) px-4 py-2.5 text-xs font-semibold text-(--grey)">
                                    {dashboard.statistics.scope === "global" ? "Total" : "Total personnel"} :
                                    {dashboard.clients.total} client{dashboard.clients.total > 1 ? "s" : ""}
                                </div>
                            </section>
                        {/if}
                    </div>
                </div>
            {/if}
        </main>
    </div>
</div>
