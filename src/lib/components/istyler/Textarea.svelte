<script lang="ts">
    import { afterUpdate } from "svelte";
    import * as Icon from "lucide-svelte";
    import { Tooltip } from 'bits-ui';
    import MyTooltip from "../MyTooltip.svelte";
    import "./iStyler.css";

    export let label: string | undefined = undefined;
    export let placeholder: string | undefined = undefined;
    export let name: string | undefined = undefined;
    export let required: boolean = false;
    export let disabled: boolean = false;
    export let readonly: boolean = false;
    export let value: string | null = null;
    export let helpText: string | undefined = undefined;
    export let helpTextIcon: boolean = false;
    export let parentClass: string = "";
    export let autoGrow: boolean = false;
    export let maxlength: number | undefined = undefined;
    export let rows: number | undefined = undefined;
    export let resize: "none" | "vertical" | "horizontal" | "both" = "vertical";
    export let ariaLabel: string | undefined = undefined;
    export let onkeydown: ((event: KeyboardEvent) => void) | undefined = undefined;

    export let tabindex: number | null | undefined = -1;

    let textarea: HTMLTextAreaElement;

    const resizeToContent = () => {
        if (!autoGrow || !textarea) return;

        textarea.style.height = "0";
        const maxHeight = Number.parseFloat(getComputedStyle(textarea).maxHeight);
        const height = Number.isFinite(maxHeight) ? Math.min(textarea.scrollHeight, maxHeight) : textarea.scrollHeight;
        textarea.style.height = `${height}px`;
        textarea.style.overflowY = textarea.scrollHeight > height ? "auto" : "hidden";
    };

    afterUpdate(resizeToContent);
</script>

<div class="flex w-full gap-1 flex-col">
    {#if label || required}
        <span class="input-label">
            {#if label}{label}{/if}
            {#if required}
                <Tooltip.Provider>
                    <Tooltip.Root delayDuration={150}>
                        <Tooltip.Trigger>
                            {#snippet child({ props })}
                                <button type="button" class="required-star" {...props} tabindex={tabindex}>
                                    <Icon.Asterisk size=16 fill="var(--red)" />
                                </button>
                            {/snippet}
                        </Tooltip.Trigger>
                        <MyTooltip>Cette donnée est requise</MyTooltip>
                    </Tooltip.Root>
                </Tooltip.Provider>
            {/if}
        </span>
    {/if}
    <div class="textarea-container {parentClass}">
        <textarea
            bind:this={textarea}
            {placeholder}
            {name}
            {required}
            {disabled}
            {readonly}
            {maxlength}
            {rows}
            {onkeydown}
            aria-label={ariaLabel}
            style:resize
            bind:value={value}
        ></textarea>
    </div>
    {#if helpText}
        <span class="input-help-text">
            {#if helpTextIcon}
                <span class="help-icon"><Icon.Info /></span>
            {/if}
            {helpText}
        </span>
    {/if}
</div>
