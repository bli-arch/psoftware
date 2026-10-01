<script lang="ts">
    import * as Icon from "lucide-svelte";
    import { Popover, Tooltip } from "bits-ui";
    import MyPopover from "../MyPopover.svelte";
    import MyTooltip from "../MyTooltip.svelte";
    import CalendarPicker from "./CalendarPicker.svelte";
    import TimePicker from "./TimePicker.svelte";
    import {
        clampDateValue,
        formatDateValue,
        normalizeDateBounds,
        normalizeDateMode,
        normalizeDateValue,
        type DateMode,
    } from "./dateValue";
    import "./iStyler.css";

    export let label: string | undefined = undefined;
    export let name: string | undefined = undefined;
    export let required = false;
    export let disabled = false;
    export let readonly = false;
    export let value: string | Date | null = null;
    export let min: string | Date | null | undefined = undefined;
    export let max: string | Date | null | undefined = undefined;
    export let mode: DateMode = "date";
    export let placeholder: string | undefined = undefined;
    export let icon = "CalendarDays";
    export let calendarIcon = "Calendar";
    export let clearable = true;
    export let showCalendar = true;
    export let showFormattedValue = true;
    export let showSeconds = false;
    export let helpText: string | undefined = undefined;
    export let helpTextIcon = false;
    export let parentClass = "";
    export let tabindex: number | null | undefined = -1;
    export let onchange: ((value: string | null) => void) | undefined = undefined;

    const PLACEHOLDERS: Record<DateMode, string> = {
        date: "Sélectionner une date",
        month: "Sélectionner un mois",
        year: "Sélectionner une année",
        time: "Sélectionner une heure",
        "time-ms": "Saisir une durée",
    };

    let pickerOpen = false;
    let pickerAnchor: HTMLDivElement | null = null;

    $: activeMode = normalizeDateMode(mode);
    $: isTime = activeMode === "time";
    $: isDuration = activeMode === "time-ms";
    $: isTimeMode = isTime || isDuration;
    $: timeMode = isDuration ? "time-ms" : "time";
    $: calendarMode = activeMode === "month" || activeMode === "year" ? activeMode : "date";
    $: dateInputType = activeMode === "year" ? "number" : activeMode === "month" ? "month" : "date";
    $: hasPicker = isTimeMode || showCalendar;
    $: isLocked = disabled || readonly;
    $: effectivePlaceholder = placeholder?.trim() || PLACEHOLDERS[activeMode];
    $: rawValue = normalizeDateValue(value, activeMode, showSeconds);
    $: [inputMin, inputMax] = normalizeDateBounds(min, max, activeMode, showSeconds);
    $: readableValue = formatDateValue(rawValue, activeMode);
    $: showReadableValue = showFormattedValue && (activeMode === "date" || activeMode === "month");
    $: LeftIconComponent = icon && Icon[icon as keyof typeof Icon]
        ? Icon[icon as keyof typeof Icon]
        : null;
    $: effectivePickerIcon = calendarIcon
        || (isDuration ? "Timer" : isTime ? "Clock3" : "Calendar");
    $: PickerIconComponent = effectivePickerIcon && Icon[effectivePickerIcon as keyof typeof Icon]
        ? Icon[effectivePickerIcon as keyof typeof Icon]
        : null;

    function commit(nextValue: string | null) {
        if (isLocked) return;
        const next = clampDateValue(nextValue, inputMin, inputMax, activeMode, showSeconds);
        value = next;
        onchange?.(next);
    }

    function handleInput(event: Event & { currentTarget: HTMLInputElement }) {
        commit(event.currentTarget.value || null);
    }

    function setPickerOpen(open: boolean) {
        if (open && isLocked) return;
        pickerOpen = open;
    }

    function handleTimeInvalid(event: Event) {
        event.preventDefault();
        setPickerOpen(true);
        requestAnimationFrame(() => {
            pickerAnchor?.querySelector<HTMLButtonElement>(".date-value-trigger")?.focus();
        });
    }
</script>

<div class="flex w-full flex-col gap-1">
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

    <Popover.Root open={pickerOpen} onOpenChange={setPickerOpen}>
        <div
            bind:this={pickerAnchor}
            class="date-input-container {parentClass} {disabled ? '--disabled' : ''} {readonly ? '--readonly' : ''} {LeftIconComponent ? '--has-left-icon' : ''} {hasPicker || clearable ? '--has-actions' : ''}"
        >
            {#if LeftIconComponent}
                <span class="input-icon --left">
                    <svelte:component this={LeftIconComponent as any} size={16} />
                </span>
            {/if}

            {#if isTimeMode}
                {#if name || required}
                    <span class="date-form-value" aria-hidden="true">
                        <input
                            type="text"
                            name={name ?? undefined}
                            value={rawValue ?? ""}
                            required={required && !readonly}
                            {disabled}
                            tabindex="-1"
                            autocomplete="off"
                            oninvalid={handleTimeInvalid}
                        />
                    </span>
                {/if}
                <Popover.Trigger
                    class={`date-value-trigger ${rawValue ? "" : "--placeholder"}`}
                    disabled={isLocked}
                    aria-label={label ?? effectivePlaceholder}
                >
                    {readableValue || effectivePlaceholder}
                </Popover.Trigger>
            {:else}
                <input
                    type={dateInputType}
                    {name}
                    value={rawValue ?? ""}
                    {required}
                    {disabled}
                    {readonly}
                    min={inputMin ?? undefined}
                    max={inputMax ?? undefined}
                    placeholder={activeMode === "year" ? "AAAA" : effectivePlaceholder}
                    aria-label={label ?? effectivePlaceholder}
                    oninput={handleInput}
                />
            {/if}

            <div class="date-actions">
                {#if hasPicker}
                    {#if isTimeMode}
                        <button
                            type="button"
                            aria-label={pickerOpen ? "Fermer le sélecteur de temps" : "Ouvrir le sélecteur de temps"}
                            aria-expanded={pickerOpen}
                            disabled={isLocked}
                            onclick={() => setPickerOpen(!pickerOpen)}
                        >
                            {#if PickerIconComponent}
                                <svelte:component this={PickerIconComponent as any} size={16} />
                            {/if}
                        </button>
                    {:else}
                        <Popover.Trigger
                            aria-label="Ouvrir le calendrier"
                            disabled={isLocked}
                        >
                            {#if PickerIconComponent}
                                <svelte:component this={PickerIconComponent as any} size={16} />
                            {/if}
                        </Popover.Trigger>
                    {/if}
                {/if}

                {#if clearable}
                    <button
                        type="button"
                        class="date-clear-button"
                        aria-label="Effacer la valeur"
                        disabled={isLocked || !rawValue}
                        onclick={() => commit(null)}
                    >
                        <Icon.X size={16} />
                    </button>
                {/if}
            </div>
        </div>

        {#if hasPicker}
            <MyPopover
                class="date-calendar-popover"
                customAnchor={pickerAnchor}
                align="start"
                sideOffset={6}
                collisionPadding={12}
            >
                {#if isTimeMode}
                    <TimePicker
                        value={rawValue}
                        min={inputMin}
                        max={inputMax}
                        mode={timeMode}
                        {showSeconds}
                        onchange={commit}
                        close={() => setPickerOpen(false)}
                    />
                {:else}
                    <CalendarPicker
                        value={rawValue}
                        min={inputMin}
                        max={inputMax}
                        mode={calendarMode}
                        {disabled}
                        {readonly}
                        calendarLabel={label ?? "Sélection de date"}
                        onchange={commit}
                        close={() => setPickerOpen(false)}
                    />
                {/if}
            </MyPopover>
        {/if}
    </Popover.Root>

    {#if showReadableValue && readableValue}
        <span class="input-help-text">{readableValue}</span>
    {:else if showReadableValue && !rawValue}
        <span class="input-help-text">{effectivePlaceholder}</span>
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
