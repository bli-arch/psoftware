<script lang="ts">
    import type { Snippet } from "svelte";
    import { Popover, type WithoutChildrenOrChild } from "bits-ui";
    import { flyAndScale } from "../utils";
    import { twMerge } from "tailwind-merge";
    import { animationTime } from "$lib/uiPreferences";

    let {
        ref = $bindable(null),
        children,
        class: className,
        portalTarget,
        ...restProps
    }: WithoutChildrenOrChild<Popover.ContentProps> & {
        class?: string;
        children?: Snippet;
        portalTarget?: Element | string;
    } = $props();

    const resolvedPortalTarget = $derived.by(() => {
        if (portalTarget) return portalTarget;
        const anchor = restProps.customAnchor;
        return typeof Element !== "undefined" && anchor instanceof Element
            ? anchor.closest<HTMLElement>("[data-vaul-drawer], [role='dialog']") ?? undefined
            : undefined;
    });
</script>

<Popover.Portal to={resolvedPortalTarget}>
    <Popover.Content sideOffset={8} forceMount {...restProps}>
        {#snippet child({ wrapperProps, props, open })}
            {#if open}
                <div {...wrapperProps} class="z-(--z-overlay)">
                    <div
                        {...props}
                        transition:flyAndScale={{ duration: animationTime(100) }}
                        class={twMerge(
                            "bg-(--light-bg1) border border-(--light-bg3) z-(--z-overlay) flex items-center justify-center",
                            "text-sm font-medium shadow-(--shadow-popover) px-3 py-2 rounded-lg",
                            className
                        )}
                    >
                        {@render children?.()}
                    </div>
                </div>
            {/if}
        {/snippet}
    </Popover.Content>
</Popover.Portal>
