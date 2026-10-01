<script lang="ts">
    import type { Snippet } from "svelte";
    import { Tooltip, type WithoutChildrenOrChild } from "bits-ui";
    import { flyAndScale } from "../utils";
    import { animationTime } from "$lib/uiPreferences";

    let {
        ref = $bindable(null),
        children,
        ...restProps
    }: WithoutChildrenOrChild<Tooltip.ContentProps> & {
        children?: Snippet;
    } = $props();
</script>

<Tooltip.Portal>
    <Tooltip.Content sideOffset={8} forceMount {...restProps}>
        {#snippet child({ wrapperProps, props, open })}
            {#if open}
                <div {...wrapperProps} class="z-(--z-tooltip)">
                    <div
                        {...props}
                        transition:flyAndScale={{ duration: animationTime(100) }}
                        class="z-(--z-tooltip) flex items-center justify-center rounded-lg border border-(--light-bg3) bg-(--light-bg1)
                        px-3 py-2 text-sm font-medium text-(--dark-bg1) shadow-(--shadow-popover)"
                    >
                        {@render children?.()}
                    </div>
                </div>
            {/if}
        {/snippet}
    </Tooltip.Content>
</Tooltip.Portal>
