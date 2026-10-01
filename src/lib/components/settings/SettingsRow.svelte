<script lang="ts">
    import type { Snippet } from "svelte";
    import * as Icon from "lucide-svelte";
    import { slide } from "svelte/transition";
    import { twMerge } from "tailwind-merge";
    import { animationTime } from "$lib/uiPreferences";
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
        },
        info: {
            root: "border-blue-200 bg-blue-50/25",
            icon: "bg-blue-100 text-blue-700",
            badge: "bg-blue-100 text-blue-800",
        },
        success: {
            root: "border-(--green)/35 bg-(--green)/5",
            icon: "bg-(--transparent-green) text-(--green)",
            badge: "bg-(--transparent-green) text-(--green)",
        },
        warning: {
            root: "border-(--orange)/35 bg-(--orange)/5",
            icon: "bg-orange-100 text-(--orange)",
            badge: "bg-orange-100 text-(--orange)",
        },
        destructive: {
            root: "border-(--red)/40 bg-(--red)/5",
            icon: "bg-(--transparent-red) text-(--red)",
            badge: "bg-(--transparent-red) text-(--red)",
        },
    } as const;

    type Props = {
        title: string;
        description?: string;
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
        expanded?: boolean;
        inline?: boolean;
        bodyPadding?: boolean;
        attention?: boolean;
        class?: string;
    };

    let {
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
        expanded = true,
        inline = false,
        bodyPadding = true,
        attention = false,
        class: className = "",
    }: Props = $props();

    const icons = Icon as Record<string, unknown>;
    const IconComponent = $derived((icon ? icons[icon] : null) as typeof Icon.Settings | null);
    const currentVariant = $derived(variants[variant] ?? variants.default);
    const tone = $derived(getRowTone(toneClass ?? currentVariant.icon));
    const rightContent = $derived(right ?? action);
    const visibleBadges = $derived([
        ...(badge ? [{ text: badge }] : []),
        ...badges.map((item) => typeof item === "string" ? { text: item } : item),
    ]);
</script>

<div
    class={twMerge(
        "settings-row settings-container overflow-hidden",
        inline ? "settings-container-inline border-b" : "rounded-xl border",
        currentVariant.root,
        className,
    )}
>
    <div
        class="flex w-full items-center justify-between gap-4 px-4 py-(--settings-row-y,0.75rem)"
        style={IconComponent && variant !== "destructive" ? tone.background : undefined}
    >
        <div class="flex min-w-0 items-center gap-3">
            {#if IconComponent}
                <span class={twMerge("flex shrink-0 items-center justify-center", tone.iconClass)}>
                    <IconComponent size={20} strokeWidth={1.6} />
                </span>
            {/if}

            <div class="min-w-0">
                <div class="flex min-w-0 flex-wrap items-center gap-2">
                    <div class="truncate text-sm font-medium text-(--dark-bg1)">{title}</div>
                    {#if attention}
                        <span class="relative flex size-2" aria-label="Configuration requise">
                            <span class="absolute inline-flex size-full animate-ping rounded-full bg-(--red) opacity-60 motion-reduce:animate-none"></span>
                            <span class="relative inline-flex size-2 rounded-full bg-(--red)"></span>
                        </span>
                    {/if}
                    {#each visibleBadges as item}
                        <span class={twMerge("shrink-0 rounded-sm px-2 py-0.5 text-xs font-semibold", currentVariant.badge, item.class)}>
                            {item.text}
                        </span>
                    {/each}
                </div>
                {#if description}
                    <div class="mt-0.5 text-xs leading-4 text-(--grey)">{description}</div>
                {/if}
            </div>
        </div>

        {#if rightContent}
            <div class="flex shrink-0 items-center">
                {@render rightContent()}
            </div>
        {/if}
    </div>

    {#if expanded && (children || table || metadata)}
        <div class={variant === "destructive" ? "" : "bg-(--light-bg1)"} transition:slide={{ duration: animationTime() }}>
            {#if children}
                <div class={twMerge("border-t border-(--light-bg3)", bodyPadding ? "p-4" : "")}>
                    {@render children()}
                </div>
            {/if}

            {#if table}
                <div class="px-4">
                    {@render table()}
                </div>
            {/if}

            {#if metadata}
                <div class="border-t border-(--light-bg3) px-4 py-3">
                    {@render metadata()}
                </div>
            {/if}
        </div>
    {/if}
</div>
