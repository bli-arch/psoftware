<script lang="ts">
    import { Accordion } from "bits-ui";
    import * as Icon from "lucide-svelte";
    import LucideIcon from "$lib/components/Badge/LucideIcon.svelte";
    import { getRowTone } from "$lib/components/settings/rowTone";

    let {
        title,
        preview,
        icon,
        iconClass,
        iconStyle,
        open = false,
    }: {
        title: string;
        preview: string;
        icon: PropertyKey;
        iconClass: string;
        iconStyle?: string;
        open?: boolean;
    } = $props();
</script>

<Accordion.Trigger
    class="flex w-full cursor-pointer items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-(--light-bg2)/70 focus:outline-none"
>
    <div class="flex min-w-0 flex-1 items-center justify-between gap-4">
        <div class="flex min-w-0 items-center gap-3">
            <span
                class="flex shrink-0 items-center justify-center {getRowTone(iconClass).iconClass}"
                style={iconStyle}
                style:background-color="transparent"
            >
                <LucideIcon name={icon} size={20} strokeWidth={1.6} />
            </span>

            <span class="truncate text-sm font-medium text-(--dark-bg1)">{title}</span>
        </div>

        <span class="hidden min-w-0 max-w-64 truncate text-xs text-(--grey) md:block">
            {preview}
        </span>
    </div>

    <span class="flex size-7 shrink-0 items-center justify-center rounded-md">
        <Icon.ChevronDown
            size={15}
            class="text-(--grey) transition-transform duration-(--animation-duration) {open ? 'rotate-180' : ''}"
        />
    </span>
</Accordion.Trigger>
