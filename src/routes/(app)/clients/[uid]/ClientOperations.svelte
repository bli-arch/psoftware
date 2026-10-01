<script lang="ts">
    import { StateBadge } from "$lib/components/Badge";
    import LucideIcon from "$lib/components/Badge/LucideIcon.svelte";
    import { Button } from "$lib/components/istyler";
    import { operationSingularLower } from "$lib/operationDisplay";
    import { appSettings } from "$lib/settings";
    import { strftime } from "$lib/utils";
    import OperationForm from "../../operations/OperationForm.svelte";

    let {
        client,
        operations = [],
        states = [],
        canCreate = false,
        onCreated,
    } = $props<{
        client: Record<string, any>;
        operations?: Array<Record<string, any>>;
        states?: Array<Record<string, any>>;
        canCreate?: boolean;
        onCreated?: (operation: Record<string, any>) => void;
    }>();

    let operationDraft = $state<Record<string, any>>({ formID: 0, client: null, data: {} });
</script>

<div class="flex h-full flex-col overflow-y-auto">
    {#if canCreate}
        <div class="p-4">
            <OperationForm
                formResponse={operationDraft}
                presetClient={client}
                direction="right"
                {onCreated}
            >
                {#snippet children(builder)}
                    <Button
                        {builder}
                        variant="secondary"
                        size="sm"
                        class="w-full"
                        icon={$appSettings.value.operation.operationIcon || "BriefcaseBusiness"}
                        label={`Créer ${operationSingularLower($appSettings.value.operation)}`}
                    />
                {/snippet}
            </OperationForm>
        </div>
    {/if}

    {#if operations.length}
        <div class="divide-y divide-(--light-bg3) border-y border-(--light-bg3)">
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
    {:else}
        <div class="flex min-h-64 flex-col items-center justify-center gap-2 px-6 text-center">
            <LucideIcon name={$appSettings.value.operation.operationIcon as any} size={22} class="text-(--grey)" />
            <p class="text-sm font-medium text-(--dark-bg1)">Aucune {operationSingularLower($appSettings.value.operation)}</p>
            <p class="text-xs leading-5 text-(--grey)">Ce client n'a pas encore de {operationSingularLower($appSettings.value.operation)} liée.</p>
        </div>
    {/if}
</div>
