<script lang="ts">
    import * as icons from "lucide-svelte";
    import type { IconProps } from "lucide-svelte";
    import type { SvelteComponent } from "svelte";

    export let name: PropertyKey;

    $: Icon = icons[name as keyof typeof icons] as typeof SvelteComponent<IconProps>;
</script>

{#if Icon}
    <svelte:component this={Icon} {...$$restProps} />
{/if}
