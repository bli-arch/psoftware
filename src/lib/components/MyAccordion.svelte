<script lang="ts">
    import type { Snippet } from "svelte";
    import { Accordion, type WithoutChildrenOrChild } from "bits-ui";
    import { slide } from "svelte/transition";
    import { animationTime } from "$lib/uiPreferences";
    
    type Props = WithoutChildrenOrChild<Accordion.ContentProps> & {
        children?: Snippet;
        class?: string;
        duration?: number;
        keepMounted?: boolean;
        expanded?: boolean;
        bordered?: boolean;
    };

    let {
        ref = $bindable(null),
        class: className,
        duration = 200,
        keepMounted = false,
        expanded = false,
        bordered = true,
        children,
        ...restProps
    }: Props = $props();

    let hasOpened = $state(false);

    $effect(() => {
        if (expanded) hasOpened = true;
    });
</script>

<Accordion.Content
    bind:ref
    forceMount={true}
    {...restProps}
>
    {#snippet child({ props, open })}
        {#if keepMounted}
            {#if hasOpened}
                <div
                    {...props}
                    class="grid transition-[grid-template-rows] duration-(--animation-duration) ease-out {open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}"
                    aria-hidden={!open}
                    inert={!open}
                    in:slide={{ duration: animationTime(duration) }}
                >
                    <div class="min-h-0 overflow-hidden {open && bordered ? 'border-t border-(--light-bg3)' : ''} {className}">
                        {@render children?.()}
                    </div>
                </div>
            {/if}
        {:else if open}
            <div
                {...props}
                class="{bordered ? 'border-t border-(--light-bg3)' : ''} {className}"
                transition:slide={{ duration: animationTime(duration) }}
            >
                {@render children?.()}
            </div>
        {/if}
    {/snippet}
</Accordion.Content>
