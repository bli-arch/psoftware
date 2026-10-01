<script lang="ts">
    import type { Snippet } from "svelte";
    import { twMerge } from "tailwind-merge";

    type Props = {
        children?: Snippet;
        class?: string;
    };

    let { children, class: className = "" }: Props = $props();
</script>

<div class={twMerge("settings-group flex flex-col", className)}>
    {@render children?.()}
</div>

<style>
    :global(.settings-group > .settings-container),
    :global(.settings-group > .settings-accordion > .settings-accordion-item) {
        border-radius: 0;
    }

    :global(.settings-group > .settings-container:not(:last-child)),
    :global(.settings-group > .settings-accordion:not(:last-child) > .settings-accordion-item) {
        border-bottom-width: 0;
    }

    :global(.settings-group > .settings-container:first-child),
    :global(.settings-group > .settings-accordion:first-child > .settings-accordion-item) {
        border-top-left-radius: 0.75rem;
        border-top-right-radius: 0.75rem;
    }

    :global(.settings-group > .settings-container:last-child),
    :global(.settings-group > .settings-accordion:last-child > .settings-accordion-item) {
        border-bottom-right-radius: 0.75rem;
        border-bottom-left-radius: 0.75rem;
    }

    :global(.settings-group > .settings-container-inline) {
        border-right-width: 0;
        border-left-width: 0;
        border-radius: 0;
    }

    :global(.settings-group > .settings-accordion.settings-container-inline > .settings-accordion-item) {
        border-radius: 0;
    }

    :global(.settings-group > .settings-container-inline:first-child) {
        border-top-width: 0;
    }

    :global(.settings-group > .settings-container-inline:not(:last-child)) {
        border-bottom-width: 1px;
    }

    :global(.settings-group > .settings-container-inline:last-child) {
        border-bottom-width: 0;
    }

    :global(.settings-group > .settings-accordion.settings-container-inline:last-child > .settings-accordion-item) {
        border-bottom-width: 0;
    }
</style>
