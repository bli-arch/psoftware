<script lang="ts" module>
    export type MyTab = {
        value: string;
        label: string;
        icon?: string;
        disabled?: boolean;
    };
</script>

<script lang="ts">
    import type { Snippet } from "svelte";
    import { Tabs } from "bits-ui";
    import { twMerge } from "tailwind-merge";
    import LucideIcon from "$lib/components/Badge/LucideIcon.svelte";

    type Props = {
        tabs: MyTab[];
        value?: string;
        disabled?: boolean;
        children: Snippet<[string]>;
        class?: string;
        listClass?: string;
        panelClass?: string;
        onValueChange?: (value: string) => void;
    };

    let {
        tabs,
        value = $bindable(""),
        disabled = false,
        children,
        class: className = "",
        listClass = "",
        panelClass = "",
        onValueChange,
    }: Props = $props();

    let heights = $state<Record<string, number>>({});
    const activeIndex = $derived(Math.max(0, tabs.findIndex((tab) => tab.value === value)));
    const activeHeight = $derived(heights[value] ?? 0);

    $effect(() => {
        if (!tabs.some((tab) => tab.value === value)) value = tabs[0]?.value ?? "";
    });
</script>

<Tabs.Root bind:value {disabled} {onValueChange} class={twMerge("w-full", className)}>
    <Tabs.List class={twMerge("grid h-9 grid-flow-col auto-cols-fr gap-1 rounded-lg bg-(--light-bg2) p-1", listClass)}>
        {#each tabs as tab}
            <Tabs.Trigger
                value={tab.value}
                disabled={tab.disabled}
                class="flex min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold text-(--grey) outline-none transition-(--transition) duration-(--animation-duration-150)
                    hover:text-(--dark-bg1) focus-visible:ring-2 focus-visible:ring-(--user-color)/25
                    data-[state=active]:bg-(--light-bg1) data-[state=active]:text-(--dark-bg1) data-[state=active]:shadow-sm
                    disabled:cursor-not-allowed disabled:opacity-50"
            >
                {#if tab.icon}
                    <LucideIcon name={tab.icon as any} size={14} />
                {/if}
                <span class="truncate">{tab.label}</span>
            </Tabs.Trigger>
        {/each}
    </Tabs.List>

    <div
        class="relative overflow-hidden transition-[height] duration-(--animation-duration-300) ease-out"
        style={activeHeight ? `height:${activeHeight}px` : undefined}
    >
        {#each tabs as tab, index (tab.value)}
            <Tabs.Content value={tab.value}>
                {#snippet child({ props })}
                    <div
                        {...props}
                        hidden={false}
                        role="tabpanel"
                        inert={index !== activeIndex}
                        aria-hidden={index !== activeIndex}
                        tabindex={index === activeIndex ? 0 : -1}
                        bind:clientHeight={heights[tab.value]}
                        class={twMerge(
                            "w-full rounded-b-lg outline-none transition-transform duration-(--animation-duration-300) ease-out focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--user-color)/25",
                            index === activeIndex
                                ? "relative translate-x-0"
                                : index < activeIndex
                                    ? "pointer-events-none absolute inset-x-0 top-0 -translate-x-full"
                                    : "pointer-events-none absolute inset-x-0 top-0 translate-x-full",
                            panelClass
                        )}
                    >
                        {@render children(tab.value)}
                    </div>
                {/snippet}
            </Tabs.Content>
        {/each}
    </div>
</Tabs.Root>
