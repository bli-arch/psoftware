<script lang="ts">
    import { onMount, tick, type SvelteComponent } from "svelte";
    import { Button, inputTypesMapping, type InputType } from "../istyler";
    import type { ManagedFormType } from "./formManagerTypes";
    import {
        dateDisplayOptions,
        defaultDateDisplayFormat,
        type FieldSchemaControl,
        type FieldSchemaEntry,
        type FieldSchemaGroup,
    } from "./fieldSchema";
    import DisplayInput from "./DisplayInput.svelte";
    import ReceiptDisplayInput from "./ReceiptDisplayInput.svelte";

    export let type: InputType;
    export let schema: FieldSchemaEntry[];
    export let props: Record<string, any>;
    export let formType: ManagedFormType = "operation";
    export let previewContext: Record<string, any> = {};
    export let update: (patch: Record<string, any>) => void;
    export let close: () => void;

    let local: Record<string, any> = withDefaults(props, schema);
    let previousProps = props;
    let previousSchema = schema;
    let previousDateMode = local.mode;
    let scrollViewport: HTMLDivElement | null = null;
    let scrollContent: HTMLDivElement | null = null;
    let tailSpacer: HTMLDivElement | null = null;
    let tailSpacerHeight = 0;
    let measureFrame = 0;
    let resizeObserver: ResizeObserver | null = null;

    $: PreviewComponent = inputTypesMapping[type];
    $: settingsContext = { ...local, ...previewContext, formType, fieldType: type };
    $: previewProps = { ...settingsContext, scanSensitive: false };
    $: previewStyle = getPreviewStyle(type);
    $: if (props !== previousProps || schema !== previousSchema) {
        local = withDefaults(props, schema);
        previousProps = props;
        previousSchema = schema;
        previousDateMode = local.mode;
    }
    $: if (type === "date" && local.mode !== previousDateMode) {
        const nextMode = local.mode;
        const next = { ...local };
        if (next.format === undefined || next.format === defaultDateDisplayFormat(previousDateMode)) {
            next.format = defaultDateDisplayFormat(nextMode);
        }
        if (nextMode === "time" || nextMode === "time-ms") {
            delete next.receiptFormat;
        } else if (next.receiptFormat === undefined || next.receiptFormat === defaultDateDisplayFormat(previousDateMode)) {
            next.receiptFormat = defaultDateDisplayFormat(nextMode);
        }
        if (!dateDisplayOptions(nextMode).includes(next.displayValue)) {
            next.displayValue = nextMode === "time" || nextMode === "time-ms" ? "text" : "date";
        }

        local = next;
        previousDateMode = nextMode;
    }
    $: if (
        type === "date"
        && local.mode !== "time"
        && local.mode !== "time-ms"
        && local.receiptFormat === undefined
    ) {
        local = { ...local, receiptFormat: defaultDateDisplayFormat(local.mode) };
    }

    $: sections = schema.map(toSection).filter((section) => isVisibleSection(section, settingsContext));
    $: validationErrors = sections.flatMap((section) =>
        visibleItems(section, settingsContext).flatMap((control) => {
            const error = control.validate?.(local[control.key], settingsContext);
            return error ? [error] : [];
        })
    );
    $: {
        local;
        sections;
        scheduleTailSpacerMeasure();
    }

    function isGroup(entry: FieldSchemaEntry): entry is FieldSchemaGroup {
        return "items" in entry;
    }

    function toSection(entry: FieldSchemaEntry): FieldSchemaGroup {
        return isGroup(entry)
            ? entry
            : { title: "", columns: 1, items: [entry] };
    }

    function schemaItems(entries: FieldSchemaEntry[]) {
        return entries.flatMap((entry) => isGroup(entry) ? entry.items : [entry]);
    }

    function withDefaults(source: Record<string, any>, entries: FieldSchemaEntry[]) {
        const next = { ...source };

        for (const control of schemaItems(entries)) {
            if (!("defaultValue" in control) || next[control.key] !== undefined) continue;
            next[control.key] = typeof control.defaultValue === "function"
                ? control.defaultValue(next)
                : control.defaultValue;
        }

        return next;
    }

    function getExtra(control: FieldSchemaControl, context: Record<string, any>) {
        return typeof control.extra === "function" ? control.extra(context) : (control.extra ?? {});
    }

    function isVisible(control: FieldSchemaControl, context: Record<string, any>) {
        return control.visibleWhen ? control.visibleWhen(context) : true;
    }

    function isVisibleSection(section: FieldSchemaGroup, context: Record<string, any>) {
        return section.visibleWhen ? section.visibleWhen(context) : true;
    }

    function visibleItems(section: FieldSchemaGroup, context: Record<string, any>) {
        return section.items.filter((control) => isVisible(control, context));
    }

    function getGridStyle(section: FieldSchemaGroup) {
        const columns = section.columns ?? 1;
        return `grid-template-columns: repeat(${columns}, minmax(0, 1fr));`;
    }

    function getControlStyle(control: FieldSchemaControl, section: FieldSchemaGroup) {
        const columns = section.columns ?? 1;
        const span = Math.min(control.span ?? 1, columns);
        return `grid-column: span ${span} / span ${span};`;
    }

    function isStickyPreview(control: FieldSchemaControl) {
        return control.comp === DisplayInput || control.comp === ReceiptDisplayInput;
    }

    function previewMode(control: FieldSchemaControl) {
        return control.comp === DisplayInput
            ? { showOptions: false }
            : { showControl: false };
    }

    function controlMode(control: FieldSchemaControl) {
        return isStickyPreview(control) ? { showPreview: false } : {};
    }

    function setControlValue(control: FieldSchemaControl, value: any) {
        const next = { ...local, [control.key]: value };
        if (control.key === "options" && Array.isArray(value)) {
            const validValues = new Set(value.map((option) => String(option.value)));
            next.value = Array.isArray(next.value)
                ? next.value.filter((selected) => validValues.has(String(selected)))
                : next.value === undefined || next.value === null || next.value === "" || validValues.has(String(next.value))
                    ? next.value
                    : undefined;
        }
        local = next;
    }

    function getPreviewStyle(inputType: InputType) {
        if (inputType === "dynamicgroup") {
            return "top: 14px; width: 680px; transform: translateX(-50%) scale(0.56); transform-origin: top center;";
        }

        if (inputType === "checkbox" || inputType === "radio") {
            return "top: 16px; width: 600px; transform: translateX(-50%) scale(0.68); transform-origin: top center;";
        }

        if (inputType === "textarea") {
            return "top: 50%; width: calc(100% - 3rem); transform: translate(-50%, -50%) scale(0.88); transform-origin: center;";
        }

        return "top: 50%; width: calc(100% - 3rem); transform: translate(-50%, -50%); transform-origin: center;";
    }

    function save() {
        if (validationErrors.length) return;
        update({ ...local });
        close();
    }

    function scheduleTailSpacerMeasure() {
        if (typeof requestAnimationFrame === "undefined") return;
        cancelAnimationFrame(measureFrame);
        measureFrame = requestAnimationFrame(async () => {
            await tick();
            measureTailSpacer();
        });
    }

    function measureTailSpacer() {
        if (!scrollViewport || !scrollContent || !tailSpacer) return;

        const snapTargets = scrollContent.querySelectorAll<HTMLElement>("[data-settings-snap]");
        const snapTarget = snapTargets[snapTargets.length - 1];
        if (!snapTarget) {
            tailSpacerHeight = 0;
            return;
        }

        const snapRect = snapTarget.getBoundingClientRect();
        const tailRect = tailSpacer.getBoundingClientRect();
        const contentAfterSnap = Math.max(0, tailRect.top - snapRect.bottom);
        const nextHeight = Math.max(0, scrollViewport.clientHeight - snapTarget.offsetHeight - contentAfterSnap);

        if (Math.abs(nextHeight - tailSpacerHeight) > 0.5) {
            tailSpacerHeight = nextHeight;
        }
    }

    onMount(() => {
        resizeObserver = new ResizeObserver(scheduleTailSpacerMeasure);

        if (scrollViewport) resizeObserver.observe(scrollViewport);
        if (scrollContent) resizeObserver.observe(scrollContent);

        scheduleTailSpacerMeasure();

        return () => {
            cancelAnimationFrame(measureFrame);
            resizeObserver?.disconnect();
        };
    });
</script>

<div
    class="flex h-full min-h-0 flex-col overflow-hidden bg-(--light-bg1) text-(--dark-bg1)"
    data-vaul-no-drag
    on:click|stopPropagation
    role="presentation"
>
    <div class="flex min-h-14 w-full items-center justify-between border-b border-(--light-bg3) bg-(--light-bg1) px-6">
        <div class="min-w-0">
            <h2 class="truncate text-base font-semibold leading-5">Paramètres</h2>
            <p class="text-xs font-medium text-(--grey)">Aperçu et configuration du champ</p>
        </div>
    </div>
    <div
        bind:this={scrollViewport}
        class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 bg-(--light-bg2)"
        style="scroll-snap-type: y proximity; scroll-padding-top: 0;"
    >
        <div bind:this={scrollContent} class="flex min-h-full flex-col gap-6">
            <div
                class="sticky top-0 z-20 -mx-5 h-38 shrink-0 overflow-hidden bg-(--light-bg1)"
                aria-label="Aperçu du champ"
                style="scroll-snap-align: start; scroll-snap-stop: always;"
            >
                <div
                    class="absolute inset-0"
                    style="
                        background-image: radial-gradient(var(--light-bg3) 1px, transparent 0);
                        background-position: calc(var(--spacing) * -7.5) calc(var(--spacing) * -7.5);
                        background-repeat: repeat;
                        background-size: 10px 10px;"
                ></div>
                <div class="pointer-events-none absolute left-1/2" style={previewStyle} inert aria-hidden="true">
                    <svelte:component
                        this={PreviewComponent as typeof SvelteComponent}
                        {...previewProps}
                    />
                </div>
                <div class="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-(--light-bg2) to-transparent"></div>
            </div>

            {#each sections as section}
                {@const controls = visibleItems(section, settingsContext)}
                {@const previewControl = controls.find(isStickyPreview)}
                {#if controls.length}
                    {#if previewControl}
                        <svelte:component
                            this={previewControl.comp as typeof SvelteComponent}
                            label={previewControl.label}
                            {...getExtra(previewControl, settingsContext)}
                            {...previewMode(previewControl)}
                            value={local[previewControl.key]}
                        />
                    {/if}

                    <section class="flex flex-col gap-3" class:-mt-3={Boolean(previewControl)}>
                        {#if section.title && !section.hideHeader}
                            <div class="flex flex-col gap-0.5">
                                <h3 class="text-xs font-semibold uppercase tracking-wide text-(--dark-bg1)">{section.title}</h3>
                                {#if section.description}
                                    <p class="text-xs leading-4 text-(--grey)">{section.description}</p>
                                {/if}
                            </div>
                        {/if}

                        <div class="grid gap-3" style={getGridStyle(section)}>
                            {#each controls as control}
                                <div class="min-w-0" style={getControlStyle(control, section)}>
                                    <svelte:component
                                        this={control.comp as typeof SvelteComponent}
                                        label={control.label}
                                        {...getExtra(control, settingsContext)}
                                        {...controlMode(control)}
                                        bind:value={
                                            () => local[control.key],
                                            (value) => setControlValue(control, value)
                                        }
                                    />
                                </div>
                            {/each}
                        </div>
                    </section>
                {/if}
            {/each}

            <div bind:this={tailSpacer} class="shrink-0" style={`height: ${tailSpacerHeight}px;`} aria-hidden="true"></div>
        </div>
    </div>

    <div class="flex h-15 shrink-0 items-center justify-end gap-3 border-t border-(--light-bg3) bg-(--light-bg1) px-6">
        <Button variant="secondary" class="h-9 w-fit px-5 font-medium" label="Annuler" onclick={close} />
        <Button
            variant="primary"
            class="h-9 w-fit px-5 font-medium"
            label="Enregistrer"
            icon="Save"
            disabled={validationErrors.length > 0}
            title={validationErrors[0]}
            onclick={save}
        />
    </div>
</div>
