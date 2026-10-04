<script lang="ts">
    import { goto } from "$app/navigation";
    import { ChevronRight } from "lucide-svelte";
    import { Button } from "$lib/components/istyler";
    import LucideIcon from "$lib/components/Badge/LucideIcon.svelte";
    import { getRowTone } from "$lib/components/settings/rowTone";
    import {
        buildClientIdentityFields,
        buildFieldLabelMap,
        getClientName,
        getPageIconToneClass,
        getPageIconToneStyle,
        getSummaryIcon,
    } from "../operationUtils";

    let { client, pages }: {
        client: { uid: string | number; data?: Record<string, any> };
        pages: Record<string, any>[];
    } = $props();

    const section = $derived(pages[0]);
    const labels = $derived(buildFieldLabelMap(pages));
    const name = $derived(getClientName(client, { ...labels.data, ...labels.client }, buildClientIdentityFields(pages)));
</script>

<div
    class="overflow-hidden rounded-xl border border-(--light-bg3) bg-(--light-bg1)"
    style={getPageIconToneStyle(section, true)}
>
    <Button
        variant="ghost"
        class="group h-auto w-full justify-start gap-3 rounded-none px-4 py-3 text-left font-normal whitespace-normal text-inherit transition-colors duration-(--animation-duration-150) hover:bg-(--light-bg2)/70 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--user-color)"
        confirm
        confirmTitle="Ouvrir la fiche client ?"
        confirmDescription="Vous allez quitter cette opération pour consulter la fiche du client associé."
        confirmCancelLabel="Annuler"
        confirmConfirmLabel="Voir le client"
        onclick={() => goto(`/clients/${encodeURIComponent(String(client.uid))}`)}
    >
        <span
            class="flex shrink-0 items-center justify-center {getRowTone(getPageIconToneClass(section, 'text-(--page-icon-user)')).iconClass}"
            style={getPageIconToneStyle(section)}
            style:background-color="transparent"
        >
            <LucideIcon name={getSummaryIcon(section, "UserRound")} size={20} strokeWidth={1.6} />
        </span>
        <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium text-(--dark-bg1)">{name}</span>
            <span class="block truncate text-xs text-(--grey)">{client.uid}</span>
        </span>
        <ChevronRight
            size={14}
            class="shrink-0 text-(--grey) transition-transform duration-(--animation-duration-150) group-hover:translate-x-0.5"
        />
    </Button>
</div>
