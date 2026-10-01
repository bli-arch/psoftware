<script lang="ts">
    import { onDestroy, type Snippet } from "svelte";
    import { Dialog, type WithoutChildrenOrChild } from "bits-ui";
    import { flyAndScale } from "../utils";
    import { fade } from "svelte/transition";
    import { animationTime } from "$lib/uiPreferences";
    
    type Props = WithoutChildrenOrChild<Dialog.ContentProps> & {
        children?: Snippet;
        class?: string;
        layout?: "default" | "sectioned";
        title?: string;
        description?: string;
        footer?: Snippet;
        bodyClass?: string;
    };

    let {
        ref = $bindable(null),
        class: className,
        layout = "default",
        title,
        description,
        footer,
        bodyClass = "",
        trapFocus = true,
        preventScroll = false,
        onInteractOutside,
        children,
        ...restProps
    }: Props = $props();

    function releaseOrphanedPointerLock() {
        if (typeof document === "undefined") return;
        requestAnimationFrame(() => {
            if (document.body.style.pointerEvents === "none") {
                document.body.style.removeProperty("pointer-events");
            }
        });
    }

    onDestroy(releaseOrphanedPointerLock);

</script>

<Dialog.Overlay forceMount={true}>
    {#snippet child({ props, open })}
        {#if open}
            <div
                {...props}
                class="fixed inset-0 z-(--z-overlay) bg-black/60"
                transition:fade={{ duration: animationTime() }}
            ></div>
        {/if}
    {/snippet}
</Dialog.Overlay>

<Dialog.Content
    bind:ref
    forceMount={true}
    {trapFocus}
    {preventScroll}
    {onInteractOutside}
    class="bg-(--light-bg1) text-(--dark-bg1) box-border border border-(--light-bg3) fixed z-(--z-overlay) -translate-x-1/2 -translate-y-1/2
    max-w-9/10 w-auto max-h-9/10 h-auto rounded-3xl left-1/2 top-1/2
    {layout === "sectioned" ? "flex min-h-0 flex-col overflow-hidden p-0" : "p-5"} {className}"
    {...restProps}
>
    {#snippet child({ props, open })}
        {#if open}
            <div
                {...props}
                transition:flyAndScale={{ duration: animationTime(400) }}
                onoutroend={releaseOrphanedPointerLock}
            >
                {#if layout === "sectioned"}
                    <header class="shrink-0 border-b border-(--light-bg3) px-6 py-3">
                        <Dialog.Title class="truncate text-lg font-bold font-(family-name:--font) text-(--dark-bg1)">
                            {title}
                        </Dialog.Title>
                        {#if description}
                            <Dialog.Description class="truncate text-xs font-normal font-(family-name:--font) text-(--grey)">
                                {description}
                            </Dialog.Description>
                        {/if}
                    </header>

                    <div class="min-h-0 flex-1 overflow-y-auto px-6 py-3 {footer ? "pb-20" : ""} {bodyClass}">
                        {@render children?.()}
                    </div>

                    {#if footer}
                        <footer class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-(--light-bg1) from-70% to-transparent px-6 pt-6 pb-5">
                            <div class="pointer-events-auto flex justify-end gap-2">
                                {@render footer()}
                            </div>
                        </footer>
                    {/if}
                {:else}
                    {@render children?.()}
                {/if}
            </div>
        {/if}
    {/snippet}
</Dialog.Content>
