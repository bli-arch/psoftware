<script lang="ts">
    import { apiGet } from "$lib/api";
    import { StateBadge } from "$lib/components/Badge";
    import LucideIcon from "$lib/components/Badge/LucideIcon.svelte";
    import { Button } from "$lib/components/istyler";
    import { operationSingularLower } from "$lib/operationDisplay";
    import { appSettings } from "$lib/settings";
    import { asList } from "$lib/team";
    import { strftime } from "$lib/utils";
    import * as Icon from "lucide-svelte";
    import { onMount } from "svelte";
    import { toast } from "svelte-sonner";

    type CreatedResource = { id?: number; uid: string; created_at?: string };
    type CreatedOperation = CreatedResource & { state: string | number };

    let {
        memberId,
        canViewClients = false,
        canOpenClients = false,
        canViewOperations = false,
        onCountChange,
    } = $props<{
        memberId: number;
        canViewClients?: boolean;
        canOpenClients?: boolean;
        canViewOperations?: boolean;
        onCountChange?: (count: number) => void;
    }>();

    let clients = $state<CreatedResource[]>([]);
    let operations = $state<CreatedOperation[]>([]);
    let states = $state<Array<Record<string, any>>>([]);
    let clientCount = $state(0);
    let operationCount = $state(0);
    let loading = $state(true);
    let loadError = $state("");
    let loadingMore = $state<"clients" | "operations" | null>(null);

    function resourceQuery(offset = 0, limit = 20) {
        return new URLSearchParams({
            limit: String(limit),
            offset: String(offset),
            filter_field: "creator.userId",
            filter_operator: "equals",
            filter_value: String(memberId),
            ordering: "-created_at",
        }).toString();
    }

    async function loadResources() {
        loading = true;
        loadError = "";
        try {
            const [clientResponse, operationResponse, stateResponse] = await Promise.all([
                canViewClients ? apiGet(`/core/clients/?${resourceQuery()}`) : Promise.resolve({ results: [], count: 0 }),
                canViewOperations ? apiGet(`/core/operations/?${resourceQuery()}`) : Promise.resolve({ results: [], count: 0 }),
                canViewOperations ? apiGet("/settings/state/?limit=100").catch(() => ({ results: [] })) : Promise.resolve({ results: [] }),
            ]);
            clients = asList<CreatedResource>(clientResponse);
            operations = asList<CreatedOperation>(operationResponse);
            states = asList<Record<string, any>>(stateResponse);
            clientCount = Number(clientResponse?.count) || clients.length;
            operationCount = Number(operationResponse?.count) || operations.length;
            onCountChange?.(canViewOperations ? operationCount : clientCount);
        } catch (error) {
            console.error("Failed to load team member resources", error);
            loadError = "Impossible de charger les éléments créés par cet utilisateur.";
        } finally {
            loading = false;
        }
    }

    async function loadMore(kind: "clients" | "operations") {
        if (loadingMore) return;
        loadingMore = kind;
        try {
            if (kind === "clients") {
                const response = await apiGet(`/core/clients/?${resourceQuery(clients.length)}`);
                const loaded = asList<CreatedResource>(response);
                clients = [...new Map([...clients, ...loaded].map((item) => [item.uid, item])).values()];
                clientCount = Number(response?.count) || clients.length;
                onCountChange?.(clientCount);
            } else {
                const response = await apiGet(`/core/operations/?${resourceQuery(operations.length)}`);
                const loaded = asList<CreatedOperation>(response);
                operations = [...new Map([...operations, ...loaded].map((item) => [item.uid, item])).values()];
                operationCount = Number(response?.count) || operations.length;
                onCountChange?.(operationCount);
            }
        } catch (error) {
            console.error("Failed to load more team member resources", error);
            toast.error("Impossible de charger les éléments suivants.");
        } finally {
            loadingMore = null;
        }
    }

    onMount(() => void loadResources());
</script>

<div class="flex h-full flex-col overflow-y-auto">
    {#if loading}
        <div class="flex min-h-64 items-center justify-center gap-2 text-xs text-(--grey)" role="status">
            <Icon.Loader2 size={16} class="ui-loader-spin" />
            Chargement...
        </div>
    {:else if loadError}
        <div class="flex min-h-64 flex-col items-center justify-center gap-3 px-6 text-center">
            <Icon.AlertCircle size={20} class="text-(--red)" />
            <p class="text-sm font-semibold text-(--dark-bg1)">{loadError}</p>
            <Button variant="secondary" size="sm" icon="RefreshCw" label="Réessayer" class="w-fit" onclick={loadResources} />
        </div>
    {:else}
        {#if canViewOperations}
            <section>
                {#if operations.length}
                    <div class="divide-y divide-(--light-bg3) border-b border-(--light-bg3)">
                        {#each operations as operation (operation.id ?? operation.uid)}
                            <a
                                href={`/operations/${encodeURIComponent(operation.uid)}`}
                                class="grid min-h-17 w-full grid-cols-[5.25rem_minmax(0,1fr)] bg-(--light-bg1) text-left text-inherit no-underline transition-colors duration-(--animation-duration-150) hover:bg-(--light-bg2) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--user-color)"
                            >
                                <span class="flex flex-col justify-center border-r border-(--light-bg3) px-2.5 py-2.5">
                                    {#if operation.created_at}
                                        <span class="text-xs font-bold text-(--dark-bg1)">{strftime(operation.created_at, "%d %B", "fr-FR")}</span>
                                        <span class="mt-0.5 text-[10px] text-(--grey)">{strftime(operation.created_at, "%Y · %Hh%M", "fr-FR")}</span>
                                    {:else}
                                        <span class="text-xs font-semibold text-(--grey)">Date inconnue</span>
                                    {/if}
                                </span>
                                <span class="flex min-w-0 items-center justify-between gap-3 px-3 py-2.5">
                                    <span class="min-w-0 truncate font-mono text-xs font-bold text-(--dark-bg1)">#{operation.uid}</span>
                                    <StateBadge state={operation.state} {states} class="max-w-32 shrink-0 px-2 py-0.5 text-xs font-medium" />
                                </span>
                            </a>
                        {/each}
                    </div>
                    {#if operations.length < operationCount}
                        <div class="p-4">
                            <Button
                                variant="secondary"
                                size="sm"
                                icon={loadingMore === "operations" ? "Loader2" : "ChevronDown"}
                                iconAnimation={loadingMore === "operations" ? "spin" : undefined}
                                label="Afficher la suite"
                                class="w-full"
                                disabled={Boolean(loadingMore)}
                                onclick={() => loadMore("operations")}
                            />
                        </div>
                    {/if}
                {:else}
                    <div class="flex min-h-44 flex-col items-center justify-center gap-2 px-6 text-center">
                        <LucideIcon name={$appSettings.value.operation.operationIcon as any} size={20} class="text-(--grey)" />
                        <p class="text-sm font-medium text-(--dark-bg1)">Aucune {operationSingularLower($appSettings.value.operation)}</p>
                        <p class="text-xs leading-5 text-(--grey)">Cet utilisateur n’en a encore créé aucune.</p>
                    </div>
                {/if}
            </section>
        {/if}

        {#if canViewClients}
            <section class={canViewOperations ? "border-t border-(--light-bg3)" : ""}>
                {#if clients.length}
                    <div class="divide-y divide-(--light-bg3) border-b border-(--light-bg3)">
                        {#each clients as client (client.id ?? client.uid)}
                            <svelte:element
                                this={canOpenClients ? "a" : "div"}
                                href={canOpenClients ? `/clients/${encodeURIComponent(client.uid)}` : undefined}
                                class={`grid min-h-17 w-full grid-cols-[5.25rem_minmax(0,1fr)] bg-(--light-bg1) text-left text-inherit no-underline ${canOpenClients ? "transition-colors duration-(--animation-duration-150) hover:bg-(--light-bg2) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--user-color)" : ""}`}
                            >
                                <span class="flex flex-col justify-center border-r border-(--light-bg3) px-2.5 py-2.5">
                                    {#if client.created_at}
                                        <span class="text-xs font-bold text-(--dark-bg1)">{strftime(client.created_at, "%d %B", "fr-FR")}</span>
                                        <span class="mt-0.5 text-[10px] text-(--grey)">{strftime(client.created_at, "%Y · %Hh%M", "fr-FR")}</span>
                                    {:else}
                                        <span class="text-xs font-semibold text-(--grey)">Date inconnue</span>
                                    {/if}
                                </span>
                                <span class="flex min-w-0 items-center justify-between gap-3 px-3 py-2.5">
                                    <span class="min-w-0 truncate font-mono text-xs font-bold text-(--dark-bg1)">#{client.uid}</span>
                                    {#if canOpenClients}<Icon.ChevronRight size={15} class="shrink-0 text-(--grey)" />{/if}
                                </span>
                            </svelte:element>
                        {/each}
                    </div>
                    {#if clients.length < clientCount}
                        <div class="p-4">
                            <Button
                                variant="secondary"
                                size="sm"
                                icon={loadingMore === "clients" ? "Loader2" : "ChevronDown"}
                                iconAnimation={loadingMore === "clients" ? "spin" : undefined}
                                label="Afficher la suite"
                                class="w-full"
                                disabled={Boolean(loadingMore)}
                                onclick={() => loadMore("clients")}
                            />
                        </div>
                    {/if}
                {:else}
                    <div class="flex min-h-44 flex-col items-center justify-center gap-2 px-6 text-center">
                        <Icon.BookUser size={20} class="text-(--grey)" />
                        <p class="text-sm font-medium text-(--dark-bg1)">Aucun client</p>
                        <p class="text-xs leading-5 text-(--grey)">Cet utilisateur n’en a encore créé aucun.</p>
                    </div>
                {/if}
            </section>
        {/if}
    {/if}
</div>
