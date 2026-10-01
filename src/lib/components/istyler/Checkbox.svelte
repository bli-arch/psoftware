<script lang="ts">
    import * as Icon from "lucide-svelte";
    import { Tooltip } from "bits-ui";
    import MyTooltip from "../MyTooltip.svelte";
    import { createEventDispatcher, type Snippet } from "svelte";
    import { twMerge } from "tailwind-merge";

    type CheckboxOption = {
        label: string;
        value: string | number | boolean;
        icon?: string;
        ariaLabel?: string;
        helpText?: string;
        disabled?: boolean;
        readonly?: boolean;
        hideCheckbox?: boolean;
        switchMode?: boolean;
    };

    export let label: string | undefined = undefined;
    export let name: string | undefined = undefined;
    export let value: boolean | Array<string | number | boolean> | string | number | null = false;
    export let disabled: boolean = false;
    export let readonly: boolean = false;
    export let icon: string | undefined = undefined;
    export let checkbox: boolean = true;
    export let checkmark: string | undefined = "Check";
    export let side: "left" | "right" = "right";
    export let box: boolean = false;
    export let ghosted: boolean = false;
    export let helpText: string | undefined = undefined;
    export let helpTextIcon: boolean = false;
    export let switchMode: boolean = false;
    export let required: boolean = false;
    export let options: CheckboxOption[] = [];
    export let direction: "vertical" | "horizontal" = "vertical";
    export let tabindex: number | null | undefined = -1;
    export let content: Snippet | undefined = undefined;
    
    let className: string = "";
    export { className as class };
    export let parentClass: string = "";

    const iconMap = Icon as Record<string, any>;
    const dispatch = createEventDispatcher<{ change: any }>();

    $: IconComponent = icon ? (iconMap[icon] ?? null) : null;
    $: CheckmarkComponent = checkmark ? (iconMap[checkmark] ?? null) : null;
    $: hasOptions = Array.isArray(options) && options.length > 0;
    $: selectedValues = Array.isArray(value) ? value : [];
    $: singleChecked = Boolean(value);
    $: controlTabindex = disabled ? undefined : 0;

    const getIcon = (iconName?: string) => iconName ? (iconMap[iconName] ?? null) : null;
    const isOptionDisabled = (option: CheckboxOption) => disabled || readonly || option.disabled || option.readonly;
    const isOptionChecked = (option: CheckboxOption) =>
        selectedValues.some((selectedValue) => String(selectedValue) === String(option.value));

    function toggleCheck() {
        if (disabled || readonly) return;
        value = !singleChecked;
        dispatch("change", value);
    }

    function toggleOption(option: CheckboxOption) {
        if (isOptionDisabled(option)) return;

        value = isOptionChecked(option)
            ? selectedValues.filter((selectedValue) => String(selectedValue) !== String(option.value))
            : [...selectedValues, option.value];

        dispatch("change", value);
    }

    function handleKeydown(event: KeyboardEvent, option?: CheckboxOption) {
        if (event.key !== " " && event.key !== "Enter") return;
        event.preventDefault();

        if (option) toggleOption(option);
        else toggleCheck();
    }
</script>

<div class={twMerge("flex w-full gap-1 flex-col", parentClass)}>
    {#if hasOptions}
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

        <div class={twMerge("flex gap-2 p", direction === "vertical" ? "flex-col" : "flex-row items-start overflow-x-visible")}>
            {#each options as option (String(option.value))}
                {@const checked = selectedValues.some((selectedValue) => String(selectedValue) === String(option.value))}
                {@const optionDisabled = disabled || readonly || option.disabled || option.readonly}
                {@const OptionIcon = getIcon(option.icon)}

                {#if box}
                    <div
                        class={twMerge(
                            "option-box",
                            ghosted ? "ghosted" : "",
                            checked ? "--checked" : "",
                            optionDisabled ? "--disabled" : "",
                            option.hideCheckbox ? "no-checkbox" : "",
                            direction === "horizontal" ? "w-fit!" : "w-full!",
                            className,
                        )}
                        tabindex={optionDisabled ? undefined : 0}
                        role="checkbox"
                        aria-label={option.ariaLabel ?? option.label}
                        aria-checked={checked}
                        aria-disabled={optionDisabled}
                        aria-readonly={option.readonly || readonly}
                        on:click={() => toggleOption(option)}
                        on:keydown={(event) => handleKeydown(event, option)}
                    >
                        <div class="option-container">
                            {#if side === "left"}
                                {#if option.label}<span class="font-medium">{option.label}</span>{/if}
                                {#if OptionIcon}<span class="checkbox-icon"><svelte:component this={OptionIcon} size={16} /></span>{/if}
                                <div class={`option ${option.hideCheckbox ? "hidden!" : ""}`}>
                                    <input {name} type="checkbox" class:switch={option.switchMode} checked={checked} disabled={optionDisabled} tabindex="-1" aria-hidden="true" />
                                    {#if checked && CheckmarkComponent && !option.switchMode}
                                        <span class="checkmark"><svelte:component this={CheckmarkComponent} size={16} /></span>
                                    {/if}
                                </div>
                            {:else}
                                <div class={`option ${option.hideCheckbox ? "hidden!" : ""}`}>
                                    <input {name} type="checkbox" class:switch={option.switchMode} checked={checked} disabled={optionDisabled} tabindex="-1" aria-hidden="true" />
                                    {#if checked && CheckmarkComponent && !option.switchMode}
                                        <span class="checkmark"><svelte:component this={CheckmarkComponent} size={16} /></span>
                                    {/if}
                                </div>
                                {#if OptionIcon}<span class="checkbox-icon"><svelte:component this={OptionIcon} size={16} /></span>{/if}
                                {#if option.label}<span class="font-medium">{option.label}</span>{/if}
                            {/if}
                        </div>
                        {#if option.helpText}
                            <span class="input-help-text">{option.helpText}</span>
                        {/if}
                    </div>
                {:else}
                    <div
                        class={twMerge(
                            "option-container",
                            checked ? "--checked" : "",
                            optionDisabled ? "--disabled" : "",
                            className,
                        )}
                        tabindex={optionDisabled ? undefined : 0}
                        role="checkbox"
                        aria-label={option.ariaLabel ?? option.label}
                        aria-checked={checked}
                        aria-disabled={optionDisabled}
                        aria-readonly={option.readonly || readonly}
                        on:click={() => toggleOption(option)}
                        on:keydown={(event) => handleKeydown(event, option)}
                    >
                        {#if side === "left"}
                            {#if option.label}<span class="font-medium">{option.label}</span>{/if}
                            {#if OptionIcon}<span class="checkbox-icon"><svelte:component this={OptionIcon} size={16} /></span>{/if}
                            <div class={`option ${option.hideCheckbox ? "hidden!" : ""}`}>
                                <input {name} type="checkbox" class:switch={option.switchMode} checked={checked} disabled={optionDisabled} tabindex="-1" aria-hidden="true" />
                                {#if checked && CheckmarkComponent && !option.switchMode}
                                    <span class="checkmark"><svelte:component this={CheckmarkComponent} size={16} /></span>
                                {/if}
                            </div>
                        {:else}
                            <div class={`option ${option.hideCheckbox ? "hidden!" : ""}`}>
                                <input {name} type="checkbox" class:switch={option.switchMode} checked={checked} disabled={optionDisabled} tabindex="-1" aria-hidden="true" />
                                {#if checked && CheckmarkComponent && !option.switchMode}
                                    <span class="checkmark"><svelte:component this={CheckmarkComponent} size={16} /></span>
                                {/if}
                            </div>
                            {#if OptionIcon}<span class="checkbox-icon"><svelte:component this={OptionIcon} size={16} /></span>{/if}
                            {#if option.label}<span class="font-medium">{option.label}</span>{/if}
                        {/if}
                        {#if option.helpText}
                            <span class="input-help-text">{option.helpText}</span>
                        {/if}
                    </div>
                {/if}
            {/each}
        </div>
    {:else if box}
        <div
            class={twMerge(
                "option-box",
                ghosted ? "ghosted" : "",
                singleChecked ? "--checked" : "",
                disabled || readonly ? "--disabled" : "",
                className,
            )}
            tabindex={controlTabindex}
            role="checkbox"
            aria-checked={singleChecked}
            aria-disabled={disabled || readonly}
            aria-readonly={readonly}
            on:click={toggleCheck}
            on:keydown={handleKeydown}
        >
            <div class="option-container">
                {#if side === "left"}
                    {#if label}<span class="font-medium">{label}</span>{/if}
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
                    {#if IconComponent}
                        <span class="checkbox-icon"><svelte:component this={IconComponent} size={16} /></span>
                    {/if}
                    <div class={`option ${checkbox ? "" : "hidden!"}`}>
                        <input {name} type="checkbox" class:switch={switchMode} checked={singleChecked} {disabled} readonly={readonly} tabindex="-1" aria-hidden="true" />
                        {#if singleChecked && CheckmarkComponent && !switchMode}
                            <span class="checkmark"><svelte:component this={CheckmarkComponent} size={16} /></span>
                        {/if}
                    </div>
                {:else}
                    <div class={`option ${checkbox ? "" : "hidden!"}`}>
                        <input {name} type="checkbox" class:switch={switchMode} checked={singleChecked} {disabled} readonly={readonly} tabindex="-1" aria-hidden="true" />
                        {#if singleChecked && CheckmarkComponent && !switchMode}
                            <span class="checkmark"><svelte:component this={CheckmarkComponent} size={16} /></span>
                        {/if}
                    </div>
                    {#if IconComponent}<span class="checkbox-icon"><svelte:component this={IconComponent} size={16} /></span>{/if}
                    {#if label}<span class="font-medium">{label}</span>{/if}
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
                {/if}
            </div>
        </div>
    {:else}
        <div
            class={twMerge("option-container", singleChecked ? "--checked" : "", disabled || readonly ? "--disabled" : "", className)}
            tabindex={controlTabindex}
            role="checkbox"
            aria-checked={singleChecked}
            aria-disabled={disabled || readonly}
            aria-readonly={readonly}
            on:click={toggleCheck}
            on:keydown={handleKeydown}
        >
            {#if side === "left"}
                {#if content}
                    {@render content()}
                {:else if label}
                    <span class="font-medium">{label}</span>
                {/if}
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
                {#if IconComponent}<span class="checkbox-icon"><svelte:component this={IconComponent} size={16} /></span>{/if}
                <div class={`option ${checkbox ? "" : "hidden!"}`}>
                    <input {name} type="checkbox" class:switch={switchMode} checked={singleChecked} {disabled} readonly={readonly} tabindex="-1" aria-hidden="true" />
                    {#if singleChecked && CheckmarkComponent && !switchMode}
                        <span class="checkmark"><svelte:component this={CheckmarkComponent} size={16} /></span>
                    {/if}
                </div>
            {:else}
                <div class={`option ${checkbox ? "" : "hidden!"}`}>
                    <input {name} type="checkbox" class:switch={switchMode} checked={singleChecked} {disabled} readonly={readonly} tabindex="-1" aria-hidden="true" />
                    {#if singleChecked && CheckmarkComponent && !switchMode}
                        <span class="checkmark"><svelte:component this={CheckmarkComponent} size={16} /></span>
                    {/if}
                </div>
                {#if IconComponent}<span class="checkbox-icon"><svelte:component this={IconComponent} size={16} /></span>{/if}
                {#if content}
                    {@render content()}
                {:else if label}
                    <span class="font-medium">{label}</span>
                {/if}
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
            {/if}
        </div>
    {/if}

    {#if helpText}
        <span class="input-help-text">
            {#if helpTextIcon}
                <span class="help-icon"><Icon.Info /></span>
            {/if}
            {helpText}
        </span>
    {/if}
</div>
