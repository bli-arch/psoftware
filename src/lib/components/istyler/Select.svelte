<script lang="ts">
    import { Select } from "bits-ui";
    import * as Icon from "lucide-svelte";
    import "./iStyler.css";
    import { Tooltip } from 'bits-ui';
    import MyTooltip from "../MyTooltip.svelte";
    import { fly } from "svelte/transition";
    import { createEventDispatcher } from "svelte";
    import { animationTime } from "$lib/uiPreferences";
    import { cssColor } from "$lib/color";

    export let label: string | undefined = undefined;
    export let ariaLabel: string | undefined = undefined;
    export let name: string;
    export let required: boolean = false;
    export let disabled: boolean = false;
    export let placeholder: string = '';
    export let allowDeselect: boolean = true;
    type Option = {
        value: string | number;
        label: string;
        icon?: string;
        iconColor?: string;
        helpText?: string;
        disabled?: boolean;
        readonly?: boolean;
        selected?: boolean;
    };

    type OptionGroup = {
        label: string;
        options: Option[];
        disabled?: boolean;
    };

    type SelectOption = Option | OptionGroup;

    export let options: SelectOption[] = [];
    export let value: string | number | Array<string | number> | undefined = undefined;
    export let multiple: boolean | "multiple" | "single" = false;
    export let arrow: string = "ChevronDown";
    export let helpText: string | undefined = undefined;
    export let helpTextIcon: boolean = false;
    export let parentClass: string = "";
    export let portalTarget: HTMLElement | string | undefined = undefined;
    export let onchange: ((value: SelectValue) => void) | undefined = undefined;

    export let tabindex: number | null | undefined = -1;

    let selectType: "multiple" | "single"

    $: isMultiple = multiple === true || multiple === "multiple";
    $: selectType = isMultiple ? "multiple" : "single";

    $: singleValue = !isMultiple
        ? (Array.isArray(value) ? (value[0] !== undefined ? String(value[0]) : undefined) : value !== undefined ? String(value) : undefined)
        : undefined;

    $: multipleValue = isMultiple
        ? (Array.isArray(value) ? value.map(String) : value !== undefined && value !== null && value !== "" ? [String(value)] : [])
        : undefined;

    let isOpen = false;
    let triggerElement: HTMLButtonElement | null = null;
    type SelectValue = string | number | Array<string | number> | undefined;
    const dispatch = createEventDispatcher<{ change: SelectValue }>();

    $: ArrowComponent = Icon[arrow as keyof typeof Icon] as any | null;

    $: flatOptions = options.flatMap(opt =>
        'options' in opt ? opt.options : [opt]
    );

    $: rootItems = flatOptions.map((option) => ({
        value: String(option.value),
        label: option.label,
        disabled: option.disabled || option.readonly,
    }));

    $: hasSelection = isMultiple
        ? Array.isArray(multipleValue) && multipleValue.length > 0
        : singleValue !== undefined && singleValue !== null && singleValue !== "";

    $: selectedLabel = (() => {
        const labels = flatOptions
            .filter(item =>
                Array.isArray(value)
                    ? value.some((selected) => String(selected) === String(item.value))
                    : String(item.value) === String(value)
            )
            .map(item => item.label);

        return labels.length > 0 ? labels.join(", ") : placeholder;
    })();

    $: selectedOption = !isMultiple && singleValue !== undefined && singleValue !== null && !Array.isArray(singleValue)
        ? flatOptions.find((option) => String(option.value) === String(singleValue))
        : undefined;
    $: SelectedIconComponent = selectedOption?.icon ? Icon[selectedOption.icon as keyof typeof Icon] : null;
    $: resolvedPortalTarget = portalTarget
        ?? triggerElement?.closest<HTMLElement>("[data-vaul-drawer], [role='dialog']")
        ?? undefined;

    const optionIconStyle = (color?: string) => {
        const value = cssColor(color);
        return value ? `color:${value}` : undefined;
    };

    function normalizeSelectedValue(newValue: string | string[] | undefined): SelectValue {
        if (newValue === undefined) return isMultiple ? [] : undefined;
        if (!isMultiple && newValue === "") return undefined;

        if (Array.isArray(newValue)) {
            return newValue.map((selected) => {
                const option = flatOptions.find((item) => String(item.value) === String(selected));
                return option?.value ?? selected;
            });
        }

        const option = flatOptions.find((item) => String(item.value) === String(newValue));
        return option?.value ?? newValue;
    }

    function handleValueChange(newValue: string | string[] | undefined) {
        value = normalizeSelectedValue(newValue);
        dispatch("change", value);
        onchange?.(value);
    }
</script>

<div class="flex w-full gap-1 flex-col">
  <span class="input-label">
    {#if label}
      {label}
    {/if}
    {#if required}
        <Tooltip.Provider>
            <Tooltip.Root delayDuration={150}>
                <Tooltip.Trigger>
                    {#snippet child({ props })}
                        <button type="button" class="required-star" {...props} tabindex={tabindex} >
                            <Icon.Asterisk size=16 fill="var(--red)"/>
                        </button>
                    {/snippet}
                </Tooltip.Trigger>
                <MyTooltip>Cette donnée est requise</MyTooltip>
            </Tooltip.Root>
        </Tooltip.Provider>
    {/if}
  </span>

  <div class="select-container {parentClass}">
    {#key selectType}
    <Select.Root
      {disabled}
      {name}
      {required}
      type={selectType}
      value={(isMultiple ? multipleValue : singleValue ?? "") as any}
      bind:open={isOpen}
      onValueChange={handleValueChange}
      items={rootItems}
      {allowDeselect}
    >
      <Select.Trigger bind:ref={triggerElement} class="group select-button input-container" aria-label={ariaLabel ?? label}>
        <div class="selected-value option-container flex justify-between w-full">
          <div class="select-label-container {disabled ? '--disabled' : ''}">
            {#if SelectedIconComponent && !isMultiple}
                <svelte:component this={SelectedIconComponent as any} size={16} style={optionIconStyle(selectedOption?.iconColor)} />
            {/if}
            <span class={`line-clamp-1 ${!hasSelection ? "text-(--grey) font-normal" : "font-medium"}`}>
              {selectedLabel}
            </span>
          </div>
          {#if ArrowComponent}
            <span class="h-full flex items-center text-(--grey) px-2 
                transition-all duration-(--animation-duration) group-data-[state=open]:rotate-180">
              <svelte:component this={ArrowComponent} size={16} />
            </span>
          {/if}
        </div>
      </Select.Trigger>

      <Select.Portal to={resolvedPortalTarget}>
        <Select.Content sideOffset={5} forceMount align="center">
          {#snippet child({ wrapperProps, props, open })}
            {#if open}
              <div {...wrapperProps} class="z-(--z-overlay) w-(--bits-floating-anchor-width)">
                <div {...props} transition:fly={{ y: -15, duration: animationTime(400) }} class="z-(--z-overlay) bg-(--light-bg1) select-dropdown">
                    <!-- <Select.ScrollUpButton class="flex w-full items-center justify-center">
                        <Icon.ChevronsUp size={16} />
                    </Select.ScrollUpButton> -->
                    <Select.Viewport class="select-inner-dropdown">
                        {#each options as opt, i}
                            {#if 'options' in opt}
                            <Select.Group>
                                <span class="option-group-label">{opt.label}</span>
                                <div class="option-group">
                                    {#each opt.options as option (option.value)}
                                        <Select.Item
                                            value={String(option.value)}
                                            disabled={option.disabled || option.readonly || opt.disabled}
                                            class="select-option {option.disabled || option.readonly || opt.disabled ? '--disabled' : ''}"
                                        >
                                            <div class="flex justify-between items-center">
                                            <span class="option-label flex min-w-0 items-start gap-2">
                                                {#if option.icon && Icon[option.icon as keyof typeof Icon]}
                                                    <svelte:component this={Icon[option.icon as keyof typeof Icon] as any} size={16} class="mt-0.5 shrink-0" style={optionIconStyle(option.iconColor)} />
                                                {/if}
                                                <span class="flex min-w-0 flex-col">
                                                    <span class="font-medium leading-5">{option.label}</span>
                                                    {#if option.helpText}
                                                        <span class="text-xs font-normal leading-4 text-(--grey)">{option.helpText}</span>
                                                    {/if}
                                                </span>
                                            </span>
                                            {#if isMultiple}
                                                <span class="check-indicator">
                                                {#if multipleValue?.includes(String(option.value))}
                                                    <Icon.Check size={16} />
                                                {/if}
                                                </span>
                                            {/if}
                                            </div>
                                        </Select.Item>
                                    {/each}
                                </div>
                            </Select.Group>
                            {:else}
                            <Select.Item
                                value={String(opt.value)}
                                disabled={opt.disabled || opt.readonly}
                                class="select-option {opt.disabled || opt.readonly ? '--disabled' : ''}"
                            >
                                <div class="flex justify-between items-center">
                                <span class="option-label flex min-w-0 items-start gap-2">
                                    {#if opt.icon && Icon[opt.icon as keyof typeof Icon]}
                                        <svelte:component this={Icon[opt.icon as keyof typeof Icon] as any} size={16} class="mt-0.5 shrink-0" style={optionIconStyle(opt.iconColor)} />
                                    {/if}
                                    <span class="flex min-w-0 flex-col">
                                        <span class="font-medium leading-5">{opt.label}</span>
                                        {#if opt.helpText}
                                            <span class="text-xs font-normal leading-4 text-(--grey)">{opt.helpText}</span>
                                        {/if}
                                    </span>
                                </span>
                                {#if isMultiple}
                                    <span class="check-indicator">
                                    {#if multipleValue?.includes(String(opt.value))}
                                        <Icon.Check size={16} />
                                    {/if}
                                    </span>
                                {/if}
                                </div>
                            </Select.Item>
                            {/if}
                        {/each}
                    </Select.Viewport>
                    <!-- <Select.ScrollDownButton class="flex w-full items-center justify-center">
                        <Icon.ChevronsDown size={16} />
                    </Select.ScrollDownButton> -->
                </div>
              </div>
            {/if}
          {/snippet}
        </Select.Content>
      </Select.Portal>
    </Select.Root>
    {/key}
  </div>

  {#if helpText}
    <span class="input-help-text">
      {#if helpTextIcon}
        <span class="help-icon">
          <Icon.Info />
        </span>
      {/if}
      {helpText}
    </span>
  {/if}
</div>
