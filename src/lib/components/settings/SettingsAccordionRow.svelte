<script lang="ts">
    import type { Snippet } from "svelte";
    import { Accordion } from "bits-ui";
    import * as Icon from "lucide-svelte";
    import { twMerge } from "tailwind-merge";
    import MyAccordion from "$lib/components/MyAccordion.svelte";
    import { getRowTone } from "./rowTone";

    type SettingsVariant = keyof typeof variants;
    type SettingsBadge = string | {
        text: string;
        class?: string;
    };

    const variants = {
        default: {
            root: "border-(--light-bg3) bg-(--light-bg1)",
            icon: "bg-(--light-bg2) text-(--dark-bg1)",
            badge: "bg-(--light-bg3) text-(--dark-bg1)",
            hover: "hover:bg-(--light-bg3)/20",
        },
        info: {
            root: "border-blue-200 bg-blue-50/25",
            icon: "bg-blue-100 text-blue-700",
            badge: "bg-blue-100 text-blue-800",
            hover: "hover:bg-blue-100/40",
        },
        success: {
            root: "border-(--green)/35 bg-(--green)/5",
            icon: "bg-(--transparent-green) text-(--green)",
            badge: "bg-(--transparent-green) text-(--green)",
            hover: "hover:bg-(--transparent-green)/25",
        },
        warning: {
            root: "border-(--orange)/35 bg-(--orange)/5",
            icon: "bg-orange-100 text-(--orange)",
            badge: "bg-orange-100 text-(--orange)",
            hover: "hover:bg-orange-100/50",
        },
        destructive: {
            root: "border-(--red)/40 bg-(--red)/5",
            icon: "bg-(--transparent-red) text-(--red)",
            badge: "bg-(--transparent-red) text-(--red)",
            hover: "hover:bg-(--transparent-red)/25",
        },
    } as const;

    type Props = {
        value?: string;
        title: string;
        description: string;
        icon?: string;
        variant?: SettingsVariant;
        toneClass?: string;
        badge?: string;
        badges?: SettingsBadge[];
        action?: Snippet;
        right?: Snippet;
        metadata?: Snippet;
        table?: Snippet;
        children?: Snippet;
        defaultOpen?: boolean;
        open?: boolean;
        inline?: boolean;
        bodyPadding?: boolean;
        keepMounted?: boolean;
        attention?: boolean;
        class?: string;
    };

    let {
        value,
        title,
        description,
        icon,
        variant = "default",
        toneClass,
        badge,
        badges = [],
        action,
        right,
        metadata,
        table,
        children,
        defaultOpen = false,
        open = $bindable(defaultOpen),
        inline = false,
        bodyPadding = true,
        keepMounted = false,
        attention = false,
        class: className = "",
    }: Props = $props();

    const icons = Icon as Record<string, unknown>;
    const rowValue = $derived(value ?? title);
    const IconComponent = $derived((icon ? icons[icon] : null) as typeof Icon.Settings | null);
    const currentVariant = $derived(variants[variant] ?? variants.default);
    const tone = $derived(getRowTone(toneClass ?? currentVariant.icon));
    const openItems = $derived(open ? [rowValue] : []);
    const rightContent = $derived(right ?? action);
    const visibleBadges = $derived([
        ...(badge ? [{ text: badge }] : []),
        ...badges.map((item) => typeof item === "string" ? { text: item } : item),
    ]);
</script>

<Accordion.Root
    type="multiple"
    value={openItems}
    onValueChange={(items) => (open = items.includes(rowValue))}
    class={twMerge("settings-accordion-row settings-accordion", inline ? "settings-container-inline" : "", className)}
>
    {@const isOpen = open}
    <Accordion.Item
        value={rowValue}
        class={twMerge(
            "settings-accordion-item overflow-hidden",
            inline ? "border-b" : "rounded-xl border",
            currentVariant.root
        )}
    >
        <Accordion.Header style={IconComponent && variant !== "destructive" ? tone.background : undefined}>
            <Accordion.Trigger
                class={twMerge(
                    "flex w-full cursor-pointer items-center justify-between gap-4 px-4 py-[var(--settings-row-y,0.75rem)] text-left transition-colors focus:outline-none",
                    currentVariant.hover
                )}
            >
                <div class="flex min-w-0 flex-1 items-center gap-3">
                    {#if IconComponent}
                        <span class={twMerge("flex shrink-0 items-center justify-center", tone.iconClass)}>
                            <IconComponent size={20} strokeWidth={1.6} />
                        </span>
                    {/if}

                    <div class="min-w-0">
                        <div class="flex min-w-0 flex-wrap items-center gap-2">
                            <div class="truncate text-sm font-medium text-(--dark-bg1)">
                                {title}
                            </div>

                            {#if attention}
                                <span class="relative flex size-2" aria-label="Configuration requise">
                                    <span class="absolute inline-flex size-full animate-ping rounded-full bg-(--red) opacity-60 motion-reduce:animate-none"></span>
                                    <span class="relative inline-flex size-2 rounded-full bg-(--red)"></span>
                                </span>
                            {/if}

                            {#each visibleBadges as item}
                                <span
                                    class={twMerge(
                                        "shrink-0 rounded-sm px-2 py-0.5 text-xs font-semibold",
                                        currentVariant.badge,
                                        item.class
                                    )}
                                >
                                    {item.text}
                                </span>
                            {/each}
                        </div>

                        <div class="mt-0.5 text-xs leading-4 text-(--grey)">
                            {description}
                        </div>
                    </div>
                </div>

                <div class="flex shrink-0 items-center gap-2">
                    {#if rightContent}
                        {@render rightContent()}
                    {/if}

                    <span class="flex size-7 shrink-0 items-center justify-center rounded-md">
                        <Icon.ChevronDown
                            size={15}
                            class="text-(--grey) transition-transform duration-(--animation-duration) {isOpen ? 'rotate-180' : ''}"
                        />
                    </span>
                </div>
            </Accordion.Trigger>
        </Accordion.Header>

        <MyAccordion class="settings-accordion-content {variant === 'destructive' ? '' : 'bg-(--light-bg1)'}" {keepMounted} expanded={open}>
            {#if children}
                <div class={bodyPadding ? "p-4" : ""}>
                    {@render children()}
                </div>
            {/if}

            {#if table}
                <div class="settings-table-slot px-4">
                    {@render table()}
                </div>
            {/if}

            {#if metadata}
                <div class="border-t border-(--light-bg3) px-4 py-3">
                    {@render metadata()}
                </div>
            {/if}
        </MyAccordion>
    </Accordion.Item>
</Accordion.Root>

<style>
    :global(.settings-accordion-content > div > .settings-table-slot:first-child > .settings-table) {
        border-top-width: 0;
    }
</style>
