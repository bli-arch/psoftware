<script lang="ts">
    import { ChevronRight } from "lucide-svelte";
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
    <a
        href={`/clients/${encodeURIComponent(String(client.uid))}`}
        class="group flex items-center gap-3 px-4 py-3 text-inherit no-underline outline-none transition-colors duration-(--animation-duration-150) hover:bg-(--light-bg2)/70 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--user-color)"
    >
        <span
            class="flex shrink-0 items-center justify-center {getRowTone(getPageIconToneClass(section, 'text-(--page-icon-user)')).iconClass}"
            style={getPageIconToneStyle(section)}
            style:background-color="transparent"
        >
            <LucideIcon name={getSummaryIcon(section, "UserRound")} size={20} strokeWidth={1.6} />
        </span>
        <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-medium text-(--dark-bg1)">{name}</div>
            <div class="truncate text-xs text-(--grey)">{client.uid}</div>
        </div>
        <ChevronRight
            size={14}
            class="shrink-0 text-(--grey) transition-transform duration-(--animation-duration-150) group-hover:translate-x-0.5"
        />
    </a>
</div>
