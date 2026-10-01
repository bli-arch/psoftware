<script lang="ts">
    import { Tooltip } from "bits-ui";
    import MyTooltip from "$lib/components/MyTooltip.svelte";
    import LucideIcon from "./LucideIcon.svelte";
    import type { Icon } from "lucide-svelte";
    import { twMerge } from "tailwind-merge";

    type BadgeVariant = keyof typeof variants;

    let className: string | null = null;
    export let href: string | undefined = undefined;
    export { className as class };
    export let text: string | undefined = undefined;
    export let icon: keyof Icon | undefined = undefined;
    export let iconSide: "right" | "left" = "left";
    export let animation: "pulse" | "bounce" | "ping" | "spin" | undefined = undefined;

    export let type: BadgeVariant = "neutral";

    export let tooltip: string | undefined = undefined;

    const variants = {
        error: "bg-(--red)/10 text-(--red)",
        success: "bg-(--green)/10 text-(--green)",
        warning: "bg-(--orange)/10 text-(--orange)",

        outline: "bg-blue-100 text-blue-800", // correct colors
        info: "bg-blue-100 text-blue-800", // correct colors
        neutral: "bg-(--light-bg3) text-(--dark-bg1)", // correct colors
        processing: "bg-purple-100 text-purple-800", // correct colors
        new: "bg-teal-100 text-teal-800", // correct colors
        premium: "bg-amber-100 text-amber-800", // correct colors

        ghost: "",
    };
</script>

{#if tooltip && text}
    <Tooltip.Provider>
        <Tooltip.Root delayDuration={150}>
            <Tooltip.Trigger>
                <svelte:element
                    this={href ? "a" : "span"}
                    {href}
                    class={twMerge(
                        "max-h-5.5 inline-flex gap-1 select-none items-center rounded-sm text-xs font-semibold transition-colors focus:outline-none focus:ring-2", 
                        text ? 'px-2 py-1': 'p-1',
                        icon && iconSide === 'right' ? 'pr-1' : 'pl-1', 
                        variants[type], 
                        className)}

                    {...$$restProps}
                >
                    {#if icon && iconSide === "left"}
                        <LucideIcon
                            size={12}
                            name={icon}
                            class={animation && `status-animation animate-${animation}`}
                        />
                    {/if}
                    <span class={animation && `status-animation animate-${animation}`}
                        >{text}</span
                    >
                    <slot />
                    {#if icon && iconSide === "right"}
                        <LucideIcon
                            size={12}
                            name={icon}
                            class={animation && `status-animation animate-${animation}`}
                        />
                    {/if}
                </svelte:element>
            </Tooltip.Trigger>
            <MyTooltip>{tooltip}</MyTooltip>
        </Tooltip.Root>
    </Tooltip.Provider>
{:else}
    <svelte:element
        this={href ? "a" : "span"}
        {href}

        class={twMerge(
            "max-h-5.5 inline-flex gap-1 select-none items-center rounded-sm text-xs font-semibold transition-colors focus:outline-none focus:ring-2", 
            text ? 'px-2 py-1': 'p-1',
            icon && iconSide === 'right' ? 'pr-1' : 'pl-1', 
            variants[type], 
            className)}

        {...$$restProps}
    >
        {#if icon && iconSide === "left"}
            <LucideIcon
                size={12}
                name={icon}
                class={animation && `status-animation animate-${animation}`}
            />
        {/if}
        {#if text}
            <span class={animation && `status-animation animate-${animation}`}>{text}</span>
        {/if}
        <slot />
        {#if icon && iconSide === "right"}
            <LucideIcon
                size={12}
                name={icon}
                class={animation && `status-animation animate-${animation}`}
            />
        {/if}
    </svelte:element>
{/if}
