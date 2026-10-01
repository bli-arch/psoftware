<script lang="ts">
    import { Tooltip } from "bits-ui";
    import MyTooltip from "../MyTooltip.svelte";
    import * as Icon from "lucide-svelte";
    import { createEventDispatcher } from "svelte";

    type RadioOption = {
        label: string;
        value: any;
        icon?: string;
        ariaLabel?: string;
        tooltip?: string;
        helpText?: string;
        disabled?: boolean;
        readonly?: boolean;
        hideCheckbox?: boolean;
    };

    export let options: RadioOption[] = [];
    export let label: string | undefined = undefined;
    export let required: boolean = false;
    export let disabled: boolean = false;
    export let readonly: boolean = false;
    export let name: string;
    export let value: any = null;
    export let checkmark: string | false = "Circle";
    export let side: "left" | "right" = "right";
    export let box: boolean = false;
    export let ghosted: boolean = false;
    export let parentClass: string = "";
    export let groupClass: string = "";
    export let direction: "vertical" | "horizontal" = "horizontal";
    export let helpText: string | undefined = undefined;
    export let helpTextIcon: boolean = false;
    export let tabindex: number | null | undefined = -1;

    const dispatch = createEventDispatcher<{ change: any }>();
    const iconMap = Icon as Record<string, any>;

    $: CheckmarkComponent = checkmark ? (iconMap[checkmark] ?? null) : null;

    const getIcon = (iconName?: string) => iconName ? (iconMap[iconName] ?? null) : null;
    const isOptionDisabled = (option: RadioOption) => disabled || readonly || option.disabled || option.readonly;

    function selectRadio(option: RadioOption) {
        if (isOptionDisabled(option)) return;
        value = option.value;
        dispatch("change", value);
    }
</script>

{#snippet optionIcon(OptionIcon: any, tooltip?: string)}
    {#if OptionIcon}
        {#if tooltip}
            <Tooltip.Provider>
                <Tooltip.Root delayDuration={150} disableCloseOnTriggerClick>
                    <Tooltip.Trigger>
                        {#snippet child({ props })}
                            <span class="radio-icon -m-3 p-3" {...props}>
                                <svelte:component this={OptionIcon} size={16} class="pointer-events-none" />
                            </span>
                        {/snippet}
                    </Tooltip.Trigger>
                    <MyTooltip>{tooltip}</MyTooltip>
                </Tooltip.Root>
            </Tooltip.Provider>
        {:else}
            <span class="radio-icon"><svelte:component this={OptionIcon} size={16} /></span>
        {/if}
    {/if}
{/snippet}

<div class="flex w-full gap-1 flex-col">
    <span class="input-label">
        {#if label}{label}{/if}
        {#if required}
            <Tooltip.Provider>
                <Tooltip.Root delayDuration={150}>
                    <Tooltip.Trigger>
                        {#snippet child({ props })}
                            <button type="button" class="required-star" {...props} tabindex={tabindex}>
                                <Icon.Asterisk size={16} fill="var(--red)" />
                            </button>
                        {/snippet}
                    </Tooltip.Trigger>
                    <MyTooltip>Cette donnée est requise</MyTooltip>
                </Tooltip.Root>
            </Tooltip.Provider>
        {/if}
    </span>

    <div class={groupClass || `flex gap-2 ${direction === "vertical" ? "flex-col" : "flex-row"}`} role="radiogroup" aria-label={label ?? name}>
        {#each options as option (String(option.value))}
            {@const checked = String(value) === String(option.value)}
            {@const optionDisabled = isOptionDisabled(option)}
            {@const OptionIcon = getIcon(option.icon)}

            {#if box}
                <label
                    class={`option-box ${checked ? "--checked" : ""} ${optionDisabled ? "--disabled" : ""} ${parentClass}`}
                    class:ghosted={ghosted}
                    class:no-checkbox={option.hideCheckbox}
                >
                    <div class="option-container">
                        {#if side === "left"}
                            {#if option.label}<span class="font-medium">{option.label}</span>{/if}
                            {@render optionIcon(OptionIcon, option.tooltip)}
                            <div class="option">
                                <input {name} type="radio" value={String(option.value)} aria-label={option.ariaLabel ?? option.label} checked={checked} disabled={optionDisabled} onchange={() => selectRadio(option)} />
                                {#if checked && CheckmarkComponent}
                                    <span class="checkmark"><svelte:component this={CheckmarkComponent} size={16} /></span>
                                {/if}
                            </div>
                        {:else}
                            <div class="option">
                                <input {name} type="radio" value={String(option.value)} aria-label={option.ariaLabel ?? option.label} checked={checked} disabled={optionDisabled} onchange={() => selectRadio(option)} />
                                {#if checked && CheckmarkComponent}
                                    <span class="checkmark"><svelte:component this={CheckmarkComponent} size={16} /></span>
                                {/if}
                            </div>
                            {@render optionIcon(OptionIcon, option.tooltip)}
                            {#if option.label}<span class="font-medium">{option.label}</span>{/if}
                        {/if}
                    </div>
                    {#if option.helpText}
                        <span class="input-help-text">{option.helpText}</span>
                    {/if}
                </label>
            {:else}
                <label
                    class={`option-container ${checked ? "--checked" : ""} ${optionDisabled ? "--disabled" : ""} ${parentClass}`}
                >
                    {#if side === "left"}
                        {#if option.label}<span class="font-medium">{option.label}</span>{/if}
                        {@render optionIcon(OptionIcon, option.tooltip)}
                        <div class={`option ${option.hideCheckbox ? "hidden!" : ""}`}>
                            <input {name} type="radio" value={String(option.value)} aria-label={option.ariaLabel ?? option.label} checked={checked} disabled={optionDisabled} onchange={() => selectRadio(option)} />
                            {#if checked && CheckmarkComponent}
                                <span class="checkmark"><svelte:component this={CheckmarkComponent} size={16} /></span>
                            {/if}
                        </div>
                    {:else}
                        <div class={`option ${option.hideCheckbox ? "hidden!" : ""}`}>
                            <input {name} type="radio" value={String(option.value)} aria-label={option.ariaLabel ?? option.label} checked={checked} disabled={optionDisabled} onchange={() => selectRadio(option)} />
                            {#if checked && CheckmarkComponent}
                                <span class="checkmark"><svelte:component this={CheckmarkComponent} size={16} /></span>
                            {/if}
                        </div>
                        {@render optionIcon(OptionIcon, option.tooltip)}
                        {#if option.label}<span class="font-medium">{option.label}</span>{/if}
                    {/if}
                    {#if option.helpText}
                        <span class="input-help-text">{option.helpText}</span>
                    {/if}
                </label>
            {/if}
        {/each}
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
