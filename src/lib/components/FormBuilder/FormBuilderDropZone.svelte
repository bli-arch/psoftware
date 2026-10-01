<script lang="ts">
    import { get } from "svelte/store";
    import { onDestroy } from "svelte";
    import { Button, Checkbox, inputTypesMapping, type InputType } from "../istyler";
    import type { FieldSchemaEntry } from "./fieldSchema";
    import FormCanvas from "./FormCanvas.svelte";
    import FormContextMenu from "./FormContextMenu.svelte";
    import { FORM_BUILDER_DRAG_TYPE, dragSize, dragType, type DroppedItem } from "./stores";
    import { FORM_COLUMNS, FORM_ROW_HEIGHT, getFieldGridStyle, getGridX, getGridY } from "./layout";
    import {
        createGroupEntry,
        groupFieldsFromItems,
        groupPreviewValue,
        groupSummary,
        schemaWithDefaults,
        settingsSchemaFor,
    } from "./builderFieldUtils";
    import * as Icon from "lucide-svelte";

    export let items: DroppedItem[] = [];
    export let updateItems: (items: DroppedItem[]) => void;
    export let openEdit: (item: DroppedItem, schema: FieldSchemaEntry[]) => void;
    export let nested = false;
    export let allowDynamicGroup = true;

    const DROP_ZONE_BOTTOM_ROWS = 16;
    const DROP_ZONE_EDGE_SCROLL = 48;
    const DROP_ZONE_SCROLL_STEP = 24;

    let wrapper: HTMLElement | undefined;
    let zone: HTMLElement | undefined;
    let draggingId: string | null = null;
    let dragOffset = { gx: 0, gy: 0 };
    let dragRows = 0;
    type ResizeDir = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";
    let resizing: { id: string; gx: number; gy: number; w: number; h: number; dir: ResizeDir } | null = null;
    let highlight: { gx: number; gy: number; w: number; h: number; valid: boolean } | null = null;

    const stopDragTypeWatch = dragType.subscribe((value) => {
        if (value === null) dragRows = 0;
    });

    $: placedRows = Math.max(0, ...items.map((item) => Number(item.gy ?? 0) + Number(item.h ?? 1)));
    $: dropZoneRows = Math.max(placedRows, dragRows);

    function isFree(gx: number, gy: number, w: number, h: number, list = items) {
        for (let x = gx; x < gx + w; x++) {
            for (let y = gy; y < gy + h; y++) {
                if (list.some((it) => x >= it.gx && x < it.gx + it.w && y >= it.gy && y < it.gy + it.h)) {
                    return false;
                }
            }
        }
        return true;
    }

    function clampGridPosition(gx: number, gy: number, w: number, h: number) {
        return {
            gx: Math.max(0, Math.min(gx, FORM_COLUMNS - w)),
            gy: Math.max(0, gy),
        };
    }

    function dragGridPosition(event: DragEvent, w: number, h: number) {
        if (!zone) return { gx: 0, gy: 0 };
        return clampGridPosition(
            getGridX(event, zone) - dragOffset.gx,
            getGridY(event, zone) - dragOffset.gy,
            w,
            h,
        );
    }

    function setDragOffset(event: DragEvent, item: DroppedItem) {
        if (!zone) {
            dragOffset = { gx: 0, gy: 0 };
            return;
        }

        const target = event.currentTarget as HTMLElement;
        const field = target.closest(".form-canvas-field") as HTMLElement | null;
        const fieldRect = field?.getBoundingClientRect();
        const zoneRect = zone.getBoundingClientRect();
        if (!fieldRect || zoneRect.width <= 0) {
            dragOffset = { gx: 0, gy: 0 };
            return;
        }

        const columnWidth = zoneRect.width / FORM_COLUMNS;
        dragOffset = {
            gx: Math.max(0, Math.min(item.w - 1, Math.floor((event.clientX - fieldRect.left) / columnWidth))),
            gy: Math.max(0, Math.min(item.h - 1, Math.floor((event.clientY - fieldRect.top) / FORM_ROW_HEIGHT))),
        };
    }

    function readDropPayload(event: DragEvent) {
        try {
            const payload = JSON.parse(
                event.dataTransfer?.getData(FORM_BUILDER_DRAG_TYPE) ||
                event.dataTransfer?.getData("text/plain") ||
                ""
            );

            if (!payload?.type || !(payload.type in inputTypesMapping)) return null;
            if (!allowDynamicGroup && payload.type === "dynamicgroup") return null;
            if (payload.existingId && !items.some((it) => it.id === payload.existingId)) return null;

            return payload;
        } catch {
            return null;
        }
    }

    function handleDragOver(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();

        const currentDragType = get(dragType);
        if (
            !zone ||
            !event.dataTransfer?.types.includes(FORM_BUILDER_DRAG_TYPE) ||
            (!allowDynamicGroup && currentDragType === "dynamicgroup")
        ) {
            highlight = null;
            return;
        }

        const [w, h] = get(dragSize) ?? [1, 1];
        const { gx, gy } = dragGridPosition(event, w, h);
        const list = items.filter((it) => it.id !== draggingId && it.id !== resizing?.id);

        highlight = { gx, gy, w, h, valid: isFree(gx, gy, w, h, list) };
        if (!nested) {
            dragRows = Math.max(dragRows, gy + h + DROP_ZONE_BOTTOM_ROWS);
            scrollDropZoneDuringDrag(event);
        }
    }

    function handleDragLeave(event: DragEvent) {
        event.stopPropagation();
        highlight = null;
    }

    function handleDrop(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();

        const payload = readDropPayload(event);
        const currentHighlight = highlight;
        highlight = null;
        const currentDragOffset = dragOffset;
        draggingId = null;
        dragOffset = { gx: 0, gy: 0 };
        dragRows = 0;
        if (!zone || !payload) return;

        const { type, size = [1, 1], props = {}, existingId } = payload;
        let gx: number;
        let gy: number;
        let w: number;
        let h: number;

        if (currentHighlight?.valid) {
            ({ gx, gy, w, h } = currentHighlight);
        } else {
            const [pw, ph] = size;
            const position = clampGridPosition(
                getGridX(event, zone) - currentDragOffset.gx,
                getGridY(event, zone) - currentDragOffset.gy,
                pw,
                ph,
            );
            gx = position.gx;
            gy = position.gy;
            w = pw;
            h = ph;
        }

        const list = existingId ? items.filter((it) => it.id !== existingId) : items;
        if (!isFree(gx, gy, w, h, list)) return;

        if (existingId) {
            updateItems(items.map((it) => it.id === existingId ? { ...it, gx, gy, w, h } : it));
            return;
        }

        const id = crypto.randomUUID().split("-").pop() as string;
        updateItems([
            ...items,
            {
                id,
                type,
                gx,
                gy,
                w,
                h,
                props: { ...props, name: id },
                ...(type === "dynamicgroup" ? { items: [] } : {}),
            },
        ]);
    }

    function deleteItem(id: string) {
        updateItems(items.filter((it) => it.id !== id));
    }

    function updateChildItems(id: string, childItems: DroppedItem[]) {
        updateItems(items.map((it) => it.id === id ? { ...it, items: childItems } : it));
    }

    function updateItemProps(id: string, patch: Record<string, any>) {
        updateItems(items.map((it) => it.id === id ? { ...it, props: { ...(it.props ?? {}), ...patch } } : it));
    }

    function fitRect(
        gx: number,
        gy: number,
        w: number,
        h: number,
        dir: ResizeDir,
        list: DroppedItem[],
        cols: number,
        rows: number,
        fallback: { gx: number; gy: number; w: number; h: number },
    ) {
        gx = Math.max(0, Math.min(gx, cols - 1));
        gy = Math.max(0, Math.min(gy, rows - 1));
        w = Math.max(1, Math.min(w, cols - gx));
        h = Math.max(1, Math.min(h, rows - gy));

        while (!isFree(gx, gy, w, h, list)) {
            if (dir.includes("e")) w--;
            if (dir.includes("s")) h--;
            if (dir.includes("w")) {
                gx++;
                w--;
            }
            if (dir.includes("n")) {
                gy++;
                h--;
            }
            if (w === 1 && h === 1) break;
        }

        if (!isFree(gx, gy, w, h, list)) return fallback;
        return { gx, gy, w, h };
    }

    function startResize(event: MouseEvent, id: string, dir: ResizeDir) {
        event.stopPropagation();
        const item = items.find((it) => it.id === id);
        if (!item) return;

        resizing = { id, gx: item.gx, gy: item.gy, w: item.w, h: item.h, dir };
        window.addEventListener("mousemove", handleResizeMove);
        window.addEventListener("mouseup", handleResizeEnd);
    }

    function handleResizeMove(event: MouseEvent) {
        if (!resizing || !zone) return;

        const x = getGridX(event, zone);
        const y = getGridY(event, zone);
        const cols = FORM_COLUMNS;
        const others = items.filter((it) => it.id !== resizing!.id);
        const rows = Math.max(y + 1, resizing.gy + resizing.h, ...others.map((it) => it.gy + it.h), 1);

        let { gx, gy, w, h } = resizing;
        let left = gx;
        let top = gy;
        let right = gx + w - 1;
        let bottom = gy + h - 1;

        if (resizing.dir.includes("e")) right = Math.max(left, Math.min(x, cols - 1));
        if (resizing.dir.includes("s")) bottom = Math.max(top, Math.min(y, rows - 1));
        if (resizing.dir.includes("w")) left = Math.min(right, Math.max(0, x));
        if (resizing.dir.includes("n")) top = Math.min(bottom, Math.max(0, y));

        const raw = {
            gx: left,
            gy: top,
            w: right - left + 1,
            h: bottom - top + 1,
        };

        const nextRect = fitRect(raw.gx, raw.gy, raw.w, raw.h, resizing.dir, others, cols, rows, resizing);
        updateItems(items.map((it) => it.id === resizing!.id ? { ...it, ...nextRect } : it));
    }

    function handleResizeEnd() {
        if (!resizing) return;

        highlight = null;
        resizing = null;
        window.removeEventListener("mousemove", handleResizeMove);
        window.removeEventListener("mouseup", handleResizeEnd);
    }

    function startDrag(event: DragEvent, item: DroppedItem) {
        draggingId = item.id;
        setDragOffset(event, item);
        dragSize.set([item.w, item.h]);
        dragType.set(item.type);
        event.dataTransfer?.setData(
            FORM_BUILDER_DRAG_TYPE,
            JSON.stringify({
                type: item.type,
                size: [item.w, item.h],
                existingId: item.id,
            }),
        );
        const target = event.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        event.dataTransfer?.setDragImage(target, event.clientX - rect.left, event.clientY - rect.top);
        (event.currentTarget as HTMLElement).parentElement?.classList.add("opacity-20");
    }

    function endDrag(event: DragEvent) {
        draggingId = null;
        dragOffset = { gx: 0, gy: 0 };
        highlight = null;
        dragRows = 0;
        dragType.set(null);
        (event.currentTarget as HTMLElement).parentElement?.classList.remove("opacity-20");
    }

    function suspendDragForControl(event: PointerEvent) {
        const target = event.target;
        if (!(target instanceof Element) || !target.closest("input, button, [role='button'], [role='combobox']")) return;

        const field = event.currentTarget as HTMLElement;
        field.draggable = false;

        const restore = () => {
            field.draggable = true;
            window.removeEventListener("pointerup", restore);
            window.removeEventListener("pointercancel", restore);
        };

        window.addEventListener("pointerup", restore, { once: true });
        window.addEventListener("pointercancel", restore, { once: true });
    }

    function groupProps(item: DroppedItem) {
        return schemaWithDefaults("dynamicgroup", item.props ?? {});
    }

    function groupValue(item: DroppedItem, fields = groupFieldsFromItems(item.items ?? [])) {
        return groupPreviewValue(groupProps(item), fields);
    }

    function groupCountLabel(item: DroppedItem) {
        const props = groupProps(item);
        const summary = groupSummary(groupValue(item), Boolean(props.checkable));
        return summary?.text ?? (props.checkable ? "0/0" : "0");
    }

    function addGroupEntry(event: MouseEvent, item: DroppedItem) {
        event.preventDefault();
        event.stopPropagation();

        const props = groupProps(item);
        const value = groupValue(item);
        if (props.maxItems != null && value.length >= Number(props.maxItems)) return;

        updateItemProps(item.id, {
            value: [...value, createGroupEntry(groupFieldsFromItems(item.items ?? []), Boolean(props.checkable))],
        });
    }

    function toggleGroupEntry(item: DroppedItem, index: number, checked: boolean) {
        const nextValue = groupValue(item).map((entry, entryIndex) => (
            entryIndex === index ? { ...entry, done: checked } : entry
        ));
        updateItemProps(item.id, { value: nextValue });
    }

    function removeGroupEntry(event: MouseEvent, item: DroppedItem, index: number) {
        event.preventDefault();
        event.stopPropagation();

        const props = groupProps(item);
        const value = groupValue(item);
        if (props.allowRemove === false || value.length <= Math.max(0, Number(props.minItems ?? 1))) return;

        updateItemProps(item.id, { value: value.filter((_, entryIndex) => entryIndex !== index) });
    }

    function commitGroupEntry(item: DroppedItem, index: number, entry: Record<string, any>) {
        updateItemProps(item.id, {
            value: groupValue(item).map((currentEntry, entryIndex) => (
                entryIndex === index ? { ...entry } : currentEntry
            )),
        });
    }

    function fieldComponent(field: Record<string, any>): any {
        return inputTypesMapping[field.type as keyof typeof inputTypesMapping] ?? null;
    }

    function groupEntryRows(childItems: DroppedItem[]) {
        return Math.max(4, ...childItems.map((item) => Number(item.gy ?? 0) + Number(item.h ?? 1)));
    }

    function groupEntryGridStyle(childItems: DroppedItem[]) {
        const rows = groupEntryRows(childItems);
        return `
            --form-columns: ${FORM_COLUMNS};
            --form-row-height: ${FORM_ROW_HEIGHT}px;
            min-height: ${rows * FORM_ROW_HEIGHT}px;
        `;
    }

    function entryFieldStyle(item: DroppedItem) {
        return `${getFieldGridStyle(item)} min-height: ${Math.max(1, Number(item.h ?? 1)) * FORM_ROW_HEIGHT}px;`;
    }

    function scrollDropZoneDuringDrag(event: DragEvent) {
        if (!wrapper) return;

        const rect = wrapper.getBoundingClientRect();
        if (event.clientY > rect.bottom - DROP_ZONE_EDGE_SCROLL) wrapper.scrollTop += DROP_ZONE_SCROLL_STEP;
        if (event.clientY < rect.top + DROP_ZONE_EDGE_SCROLL) wrapper.scrollTop -= DROP_ZONE_SCROLL_STEP;
    }

    onDestroy(stopDragTypeWatch);

</script>

<div
    role="presentation"
    bind:this={wrapper}
    class:nested-drop-zone-wrapper={nested}
    class:drop-zone-wrapper={!nested}
    style={nested ? "" : `--form-columns: ${FORM_COLUMNS}; --form-row-height: ${FORM_ROW_HEIGHT}px; --drop-zone-rows: ${dropZoneRows};`}
>
    <div class:drop-zone-surface={!nested} class:nested-drop-zone-surface={nested}>
        <FormCanvas
            fields={items}
            class={nested ? "nested-drop-zone" : "drop-zone"}
            bind:element={zone}
            ondragover={handleDragOver}
            ondragleave={handleDragLeave}
            ondrop={handleDrop}
            oncontextmenu={(event: MouseEvent) => event.preventDefault()}
        >
        {#snippet before()}
            {#if nested && !items.length}
                <div class="drop-empty-hint">
                    <Icon.MousePointerSquareDashed size={18} />
                    <span>Déposez des éléments ici</span>
                </div>
            {/if}
            {#if highlight}
                <div
                    class="highlight transition-all duration-(--animation-duration)"
                    class:invalid={!highlight.valid}
                    style={getFieldGridStyle(highlight)}
                ></div>
            {/if}
        {/snippet}

        {#snippet children({ field: item })}
            {#if item.type === "dynamicgroup"}
                {@const props = groupProps(item)}
                {@const childItems = item.items ?? []}
                {@const fields = groupFieldsFromItems(childItems)}
                {@const value = groupValue(item, fields)}
                <div
                    role="presentation"
                    class="placed size-full"
                    class:resizing={resizing?.id === item.id}
                    draggable="true"
                    on:pointerdown|capture={suspendDragForControl}
                    on:dragstart|stopPropagation={(event) => startDrag(event, item)}
                    on:dragend|stopPropagation={endDrag}
                >
                    <div class="builder-group-preview">
                        <FormContextMenu
                            onModify={() => openEdit(item, settingsSchemaFor(item.type as InputType, nested))}
                            onDelete={() => deleteItem(item.id)}
                            triggerClass="w-full"
                        >
                            <div class="builder-group-header" role="presentation">
                                <div class="flex min-w-0 flex-col">
                                    <span class="input-label truncate">{props.label ?? "Groupe"}</span>
                                    {#if props.description}
                                        <span class="input-help-text truncate">{props.description}</span>
                                    {/if}
                                </div>
                                <div class="flex shrink-0 items-center gap-2">
                                    {#if props.showCount !== false}
                                        <span class="size-8 flex-center rounded-lg bg-(--light-bg3) text-xs font-bold text-(--grey)">
                                            {groupCountLabel(item)}
                                        </span>
                                    {/if}
                                    <Button
                                        label={props.addLabel || `Ajouter ${props.itemLabel ?? "un élément"}`}
                                        icon="Plus"
                                        class="h-8 w-auto px-3"
                                        disabled={props.maxItems != null && value.length >= Number(props.maxItems)}
                                        onclick={(event: MouseEvent) => addGroupEntry(event, item)}
                                    />
                                </div>
                            </div>
                        </FormContextMenu>
                        <div class="builder-group-canvas">
                            <div class="builder-group-definition">
                                <svelte:self
                                    items={childItems}
                                    updateItems={(nextItems: DroppedItem[]) => updateChildItems(item.id, nextItems)}
                                    {openEdit}
                                    nested
                                    allowDynamicGroup={false}
                                />
                            </div>

                            {#if fields.length && value.length}
                                <div class="builder-group-entries">
                                    {#each value as entry, index}
                                        <div class="builder-group-entry">
                                            <div class="builder-group-entry-header">
                                                <div class="flex min-w-0 items-center gap-2">
                                                    {#if props.checkable}
                                                        <div class="shrink-0" on:click|stopPropagation role="presentation">
                                                            <Checkbox
                                                                value={Boolean(entry.done)}
                                                                on:change={(event) => toggleGroupEntry(item, index, Boolean(event.detail))}
                                                            />
                                                        </div>
                                                    {/if}
                                                    <span class="min-w-0 truncate text-sm font-semibold text-(--dark-bg1)">
                                                        {props.itemLabel ?? "Élément"} {index + 1}
                                                    </span>
                                                </div>
                                                {#if props.allowRemove !== false}
                                                    <Button
                                                        variant="ghost"
                                                        icon="Trash2"
                                                        class="h-7 w-7 px-2 text-(--grey) hover:text-(--red)"
                                                        disabled={value.length <= Math.max(0, Number(props.minItems ?? 1))}
                                                        onclick={(event: MouseEvent) => removeGroupEntry(event, item, index)}
                                                    />
                                                {/if}
                                            </div>

                                            <div class="builder-group-entry-fields" style={groupEntryGridStyle(childItems)}>
                                                {#each childItems as childItem, fieldIndex (childItem.id)}
                                                    {@const field = fields[fieldIndex]}
                                                    {@const FieldComponent = fieldComponent(field)}
                                                    {#if FieldComponent}
                                                        <div
                                                            class="builder-group-entry-field"
                                                            style={entryFieldStyle(childItem)}
                                                            on:click|stopPropagation
                                                            role="presentation"
                                                        >
                                                            <svelte:component
                                                                this={FieldComponent}
                                                                disabled={Boolean(entry.done)}
                                                                {...field}
                                                                name={`${field.name}-${index}`}
                                                                bind:value={entry[field.name]}
                                                                on:input={() => commitGroupEntry(item, index, entry)}
                                                                on:change={() => commitGroupEntry(item, index, entry)}
                                                                onchange={() => commitGroupEntry(item, index, entry)}
                                                            />
                                                        </div>
                                                    {:else}
                                                        <div class="builder-group-entry-field text-sm text-(--red)" style={entryFieldStyle(childItem)}>
                                                            Type de champ non supporté : {field.type ?? "inconnu"}
                                                        </div>
                                                    {/if}
                                                {/each}
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    </div>
                </div>
            {:else}
                <FormContextMenu
                    onModify={() => openEdit(item, settingsSchemaFor(item.type as InputType, nested))}
                    onDelete={() => deleteItem(item.id)}
                >
                    <div
                        role="presentation"
                        class="placed size-full"
                        class:resizing={resizing?.id === item.id}
                        draggable="true"
                        on:pointerdown|capture={suspendDragForControl}
                        on:dragstart|stopPropagation={(event) => startDrag(event, item)}
                        on:dragend|stopPropagation={endDrag}
                    >
                        <svelte:component
                            this={inputTypesMapping[item.type as keyof typeof inputTypesMapping]}
                            {...item.props}
                        />
                    </div>
                </FormContextMenu>
            {/if}
            {#each ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as dir}
                <div
                    role="presentation"
                    class="resize-handle {dir}"
                    class:resizing={resizing?.id === item.id}
                    on:mousedown|stopPropagation|preventDefault={(event) => startResize(event, item.id, dir as ResizeDir)}
                ></div>
            {/each}
        {/snippet}
        </FormCanvas>
    </div>
</div>

<style>
    .drop-zone-wrapper {
        width: 100%;
        height: 100%;
        overflow: auto;
        overscroll-behavior: contain;
        scrollbar-width: none;
    }

    .drop-zone-wrapper::-webkit-scrollbar {
        display: none;
    }

    .drop-zone-surface {
        box-sizing: border-box;
        width: 100%;
        height: 100%;
        min-height: max(100%, calc(var(--drop-zone-rows) * var(--form-row-height)));
        background-image: radial-gradient(circle at 1px 1px, var(--light-grey) 1px, transparent 1px);
        background-position: -1px -1px;
        background-repeat: repeat;
        background-size: calc(100% / var(--form-columns)) var(--form-row-height);
    }

    .nested-drop-zone-surface {
        width: 100%;
        height: 100%;
        min-height: 100%;
    }

    .nested-drop-zone-wrapper {
        width: 100%;
        height: 100%;
        min-height: 7rem;
        overflow: hidden;
    }

    :global(.form-canvas.drop-zone) {
        width: 100%;
        height: 100%;
        min-height: max(100%, calc(var(--drop-zone-rows) * var(--form-row-height)));
        padding: 0;
    }

    :global(.form-canvas.nested-drop-zone) {
        position: relative;
        width: 100%;
        height: 100%;
        min-height: 100%;
        padding: 0;
        border: 1px dashed var(--light-bg3);
        border-radius: 8px;
        background-color: var(--light-bg1);
        background-image: radial-gradient(var(--light-bg3) 1px, transparent 0);
        background-position: calc(var(--spacing) * -7.5) calc(var(--spacing) * -7.5);
        background-repeat: repeat;
        background-size: 16px 16px;
    }

    .drop-empty-hint {
        pointer-events: none;
        position: absolute;
        inset: 0;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        color: var(--grey);
        font-family: var(--font);
        font-size: 0.875rem;
        font-weight: 600;
    }

    .placed {
        position: relative;
        overflow: hidden;
        cursor: grab;
        padding: 2px;
    }

    .placed::before {
        pointer-events: none;
        position: absolute;
        inset: 0;
        z-index: 8;
        border: 1px solid rgba(0, 150, 255, 0.7);
        border-radius: 0;
        background: rgba(0, 150, 255, 0.06);
        opacity: 0;
        content: "";
        transition:
            opacity var(--animation-duration-100),
            background var(--animation-duration-100),
            border-color var(--animation-duration-100);
    }

    :global(.form-canvas-field:hover) {
        z-index: 20;
    }

    :global(.form-canvas-field:hover) .placed::before,
    .placed.resizing::before {
        opacity: 1;
    }

    .placed:active {
        cursor: grabbing;
    }

    .builder-group-preview {
        display: flex;
        height: 100%;
        min-height: 0;
        flex-direction: column;
        gap: 0.5rem;
        overflow: hidden;
    }

    .builder-group-header {
        display: flex;
        min-height: 2rem;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
    }

    .builder-group-canvas {
        display: flex;
        min-height: 7rem;
        flex: 1;
        flex-direction: column;
        gap: 0.5rem;
        overflow: auto;
    }

    .builder-group-definition {
        min-height: 7rem;
        flex: 0 0 auto;
    }

    .builder-group-entries {
        display: flex;
        min-height: 0;
        flex-direction: column;
        gap: 0.5rem;
        overflow: visible;
    }

    .builder-group-entry {
        display: flex;
        min-height: fit-content;
        flex-direction: column;
        gap: 0.5rem;
        border: 1px solid var(--light-bg3);
        border-radius: 8px;
        background: var(--light-bg1);
        padding: 0.5rem;
    }

    .builder-group-entry-header {
        display: flex;
        min-height: 1.75rem;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
    }

    .builder-group-entry-fields {
        display: grid;
        grid-template-columns: repeat(var(--form-columns), minmax(0, 1fr));
        grid-auto-rows: minmax(var(--form-row-height), auto);
        align-items: start;
        gap: 0;
        width: 100%;
    }

    .builder-group-entry-field {
        min-width: 0;
        overflow: visible;
        padding: 2px;
    }

    .highlight {
        z-index: 10;
        pointer-events: none;
        background: rgba(0, 150, 255, 0.06);
        border: 1px solid rgba(0, 150, 255, 0.7);
        border-radius: 0;
        transition:
            background var(--animation-duration-100),
            border-color var(--animation-duration-100);
    }

    .highlight.invalid {
        background: rgba(255, 0, 0, 0.25);
        border-color: rgba(255, 0, 0, 0.6);
    }

    .resize-handle {
        position: absolute;
        z-index: 25;
        width: 8px;
        height: 8px;
        pointer-events: none;
    }

    :global(.form-canvas-field:hover) .resize-handle,
    .resize-handle.resizing {
        pointer-events: auto;
    }

    .resize-handle.ne,
    .resize-handle.nw,
    .resize-handle.se,
    .resize-handle.sw {
        box-sizing: border-box;
        border: 1px solid rgba(0, 150, 255, 0.85);
        border-radius: 0;
        background: var(--light-bg1);
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.9);
        opacity: 0;
        transition:
            opacity var(--animation-duration-100),
            background var(--animation-duration-100),
            border-color var(--animation-duration-100);
    }

    :global(.form-canvas-field:hover) .resize-handle.ne,
    :global(.form-canvas-field:hover) .resize-handle.nw,
    :global(.form-canvas-field:hover) .resize-handle.se,
    :global(.form-canvas-field:hover) .resize-handle.sw,
    .resize-handle.resizing.ne,
    .resize-handle.resizing.nw,
    .resize-handle.resizing.se,
    .resize-handle.resizing.sw {
        opacity: 1;
    }

    .resize-handle.n {
        top: 0;
        left: 50%;
        width: 100%;
        transform: translate(-50%, -50%);
        cursor: ns-resize;
    }

    .resize-handle.s {
        bottom: 0;
        left: 50%;
        width: 100%;
        transform: translate(-50%, 50%);
        cursor: ns-resize;
    }

    .resize-handle.e {
        right: 0;
        top: 50%;
        height: 100%;
        transform: translate(50%, -50%);
        cursor: ew-resize;
    }

    .resize-handle.w {
        left: 0;
        top: 50%;
        height: 100%;
        transform: translate(-50%, -50%);
        cursor: ew-resize;
    }

    .resize-handle.ne {
        right: 0;
        top: 0;
        transform: translate(50%, -50%);
        cursor: nesw-resize;
    }

    .resize-handle.nw {
        left: 0;
        top: 0;
        transform: translate(-50%, -50%);
        cursor: nwse-resize;
    }

    .resize-handle.se {
        right: 0;
        bottom: 0;
        transform: translate(50%, 50%);
        cursor: nwse-resize;
    }

    .resize-handle.sw {
        left: 0;
        bottom: 0;
        transform: translate(-50%, 50%);
        cursor: nesw-resize;
    }
</style>
