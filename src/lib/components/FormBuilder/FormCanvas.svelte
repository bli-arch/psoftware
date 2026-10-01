<script lang="ts">
    import type { Snippet } from "svelte";
    import { twMerge } from "tailwind-merge";
    import { FORM_COLUMNS, FORM_ROW_HEIGHT, getFieldGridStyle, getFormFields } from "./layout";

    type RenderArgs = { field: any; index: number };

    let {
        page,
        fields,
        element = $bindable(),
        class: className = "",
        children,
        before,
        ...restProps
    }: {
        page?: any;
        fields?: any[];
        element?: HTMLElement;
        class?: string;
        children: Snippet<[RenderArgs]>;
        before?: Snippet;
        [key: string]: unknown;
    } = $props();

    const canvasFields = $derived(fields ?? getFormFields(page));
</script>

<div
    {...restProps}
    bind:this={element}
    class={twMerge("form-canvas", className)}
    style={`--form-columns: ${FORM_COLUMNS}; --form-row-height: ${FORM_ROW_HEIGHT}px;`}
>
    {#if before}
        {@render before()}
    {/if}

    {#each canvasFields as field, index (field.id ?? field.config?.name ?? field.props?.name ?? index)}
        <div class="form-canvas-field" style={getFieldGridStyle(field)}>
            {@render children({ field, index })}
        </div>
    {/each}
</div>

<style>
    .form-canvas {
        padding: 8px;
        display: grid;
        grid-template-columns: repeat(var(--form-columns), minmax(0, 1fr));
        grid-auto-rows: var(--form-row-height);
        gap: 0;
        align-items: stretch;
        width: 100%;
    }

    .form-canvas-field {
        position: relative;
        min-width: 0;
        min-height: 0;
    }
</style>
