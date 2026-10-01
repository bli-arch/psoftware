<script lang="ts">
    import { Button, TextInput } from "$lib/components/istyler";
    import { appSettings } from "$lib/settings";
    import { operationSingularLower } from "$lib/operationDisplay";
    import * as Icon from "lucide-svelte";
    import {
        getClientId,
        getClientInitials,
        getClientName,
        getClientSecondaryName,
        type ClientIdentityFields,
    } from "./operationUtils";

    let {
        clientSearchTerm = $bindable(""),
        displayedClients = [],
        selectedClient = null,
        clientFieldLabels = {},
        clientIdentityFields = {},
        allowSearch = true,
        allowCreate = true,
        createBlockedReason,
        onSearch,
        onSelect,
        onCreate,
        onResolveCreateBlock,
    }: {
        clientSearchTerm?: string;
        displayedClients?: any[];
        selectedClient?: any;
        clientFieldLabels?: Record<string, string>;
        clientIdentityFields?: ClientIdentityFields;
        allowSearch?: boolean;
        allowCreate?: boolean;
        createBlockedReason?: string;
        onSearch?: (term: string) => void | Promise<void>;
        onSelect?: (client: any) => void;
        onCreate?: () => void;
        onResolveCreateBlock?: () => void;
    } = $props();

    const isSelectedClient = (client: any) => {
        const candidateId = getClientId(client);
        if (!candidateId) return false;

        if (typeof selectedClient === "number" || typeof selectedClient === "string") {
            return String(selectedClient) === String(candidateId);
        }

        return String(getClientId(selectedClient)) === String(candidateId);
    };
</script>

<div class="mb-6">
    <h1 class="font-(family-name:--font) text-2xl font-bold tracking-tight text-(--dark-bg1)">Sélectionner un client</h1>
    <p class="text-sm leading-6 text-(--grey)">Choisissez un client existant ou créez-en un nouveau pour cette {operationSingularLower($appSettings.value.operation)}.</p>
</div>

{#if allowSearch}
    <TextInput
        placeholder="Rechercher un client..."
        name="ast-client-search"
        class="mb-5 h-11! rounded-lg!"
        icon="Search"
        iconSide="left"
        bind:value={clientSearchTerm}
        oninput={(event: Event) => onSearch?.((event.currentTarget as HTMLInputElement).value)}
    />

    <div class="mb-2.5 text-xs font-semibold uppercase tracking-widest text-(--grey)">
        {clientSearchTerm.trim() ? `Résultats (${displayedClients.length})` : "Récents"}
    </div>

    <div class="max-h-full h-full overflow-y-auto flex flex-col gap-1.5 pb-5 no-scrollbar">
        {#if displayedClients.length > 0}
            {#each displayedClients as client, index (`${getClientId(client) ?? index}`)}
                <button
                    type="button"
                    class={`flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors duration-(--animation-duration-150) ${
                        isSelectedClient(client)
                            ? "border-(--user-color)/80 bg-(--user-color)/10"
                            : "border-transparent bg-transparent hover:border-(--light-bg3) hover:bg-(--light-bg1)"
                    }`}
                    onclick={() => onSelect?.(client)}
                >
                    <div class="flex size-9 shrink-0 items-center justify-center rounded-full bg-(--user-color)/10 text-xs font-semibold text-(--user-color)">
                        {getClientInitials(client, clientFieldLabels, clientIdentityFields)}
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="mb-0.5 truncate text-sm font-medium text-(--dark-bg1)">{getClientName(client, clientFieldLabels, clientIdentityFields)}</div>
                        {#if getClientSecondaryName(client, clientIdentityFields)}
                            <div class="truncate text-xs text-(--dark-bg1)/70">{getClientSecondaryName(client, clientIdentityFields)}</div>
                        {/if}
                        <div class="truncate text-xs text-(--grey)">{client.uid ?? getClientId(client)}</div>
                    </div>
                </button>
            {/each}
        {:else}
            <div class="flex-center flex-col gap-2 px-4 py-3.5 text-sm italic font-semibold text-(--grey)">
                <Icon.Search size="24" />
                {clientSearchTerm.trim() ? "Aucun client ne correspond à cette recherche." : "Aucun client récent disponible."}
            </div>
        {/if}
    </div>
{/if}

{#if allowCreate}
    {#if allowSearch}
        <div class="flex items-center gap-3">
            <div class="h-px flex-1 bg-(--light-bg3)"></div>
            <span class="text-xs text-(--grey)">ou</span>
            <div class="h-px flex-1 bg-(--light-bg3)"></div>
        </div>
    {/if}

    <Button
        variant="ghost"
        class="group/create-card flex justify-start min-h-fit w-full items-center gap-3.5 rounded-lg border border-dashed border-(--light-bg3) bg-transparent px-4 py-3.5 mt-5 text-left hover:border-(--user-color) hover:bg-(--user-color)/5"
        onclick={onCreate}
    >
        <div class="size-9 flex-center bg-(--light-bg3) text-(--grey) rounded-lg transition-(--transition) group-hover/create-card:bg-(--user-color)/10 group-hover/create-card:text-(--user-color)">
            <Icon.Plus size="16" />
        </div>
        <div>
            <div class="mb-0.5 text-sm font-medium text-(--dark-bg1)">Créer un nouveau client</div>
            <div class="text-xs text-(--grey)">Remplir la fiche client en quelques secondes</div>
        </div>
    </Button>
{:else if createBlockedReason}
    <div class="mt-5 flex items-center gap-3 rounded-lg border border-(--red)/30 bg-(--transparent-red) px-4 py-3">
        <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-(--light-bg1) text-(--red)">
            <Icon.ShieldAlert size="16" />
        </div>
        <div class="min-w-0 flex-1">
            <div class="text-sm font-medium text-(--dark-bg1)">Création de client bloquée</div>
            <div class="mt-0.5 text-xs leading-5 text-(--grey)">{createBlockedReason}</div>
        </div>
        {#if onResolveCreateBlock}
            <Button
                variant="secondary"
                size="sm"
                icon="Settings"
                label="Configurer"
                class="w-fit shrink-0"
                onclick={onResolveCreateBlock}
            />
        {/if}
    </div>
{/if}
