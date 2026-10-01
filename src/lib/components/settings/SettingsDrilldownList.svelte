<script lang="ts" module>
    export type SettingsDrilldownItem = {
        id: string | number;
        title: string;
        description?: string;
        icon?: string;
        color?: string;
    };
</script>

<script lang="ts">
    import { onDestroy, type Snippet } from "svelte";
    import { flip } from "svelte/animate";
    import * as Icon from "lucide-svelte";
    import LucideIcon from "$lib/components/Badge/LucideIcon.svelte";
    import { Button } from "$lib/components/istyler";
    import { cssColor } from "$lib/color";
    import { animationTime } from "$lib/uiPreferences";

    type Props = {
        items: SettingsDrilldownItem[];
        selectedId?: string | number | null;
        emptyTitle?: string;
        emptyDescription?: string;
        detail?: Snippet<[SettingsDrilldownItem]>;
        detailRight?: Snippet<[SettingsDrilldownItem]>;
        itemLeft?: Snippet<[SettingsDrilldownItem]>;
        itemRight?: Snippet<[SettingsDrilldownItem]>;
        listFooter?: Snippet;
        actions?: Snippet<[SettingsDrilldownItem | null]>;
        onBack?: (item: SettingsDrilldownItem) => void;
        onReorder?: (oldIndex: number, newIndex: number, orderedIds: string[]) => void;
        reorderHandle?: string;
        backLabel?: string;
        backConfirm?: boolean;
        backConfirmTitle?: string;
        backConfirmDescription?: string;
        backConfirmCancelLabel?: string;
        backConfirmConfirmLabel?: string;
        listElement?: HTMLElement | null;
        showItemIcon?: boolean;
    };

    let {
        items,
        selectedId = $bindable(null),
        emptyTitle = "Aucun élément",
        emptyDescription = "",
        detail,
        detailRight,
        itemLeft,
        itemRight,
        listFooter,
        actions,
        onBack,
        onReorder,
        reorderHandle = ".grabber",
        backLabel,
        backConfirm = false,
        backConfirmTitle = "Quitter sans enregistrer ?",
        backConfirmDescription = "Les modifications de cette colonne ne sont pas encore enregistrées.",
        backConfirmCancelLabel = "Rester",
        backConfirmConfirmLabel = "Quitter",
        listElement = $bindable(null),
        showItemIcon = true,
    }: Props = $props();

    const selectedItem = $derived(items.find((item) => item.id === selectedId) ?? null);
    let activeView = $state<"main" | "detail">("main");
    let detailItem = $state<SettingsDrilldownItem | null>(null);
    let mainHeight = $state(0);
    let detailHeight = $state(0);
    let draggingId = $state<string | null>(null);
    let dragTargetId = $state<string | null>(null);
    let dragPlacement = $state<"before" | "after">("before");
    let dragStartId: string | null = null;
    const sliderHeight = $derived(activeView === "detail" && detailHeight ? detailHeight : mainHeight);

    function rowId(item: SettingsDrilldownItem) {
        return String(item.id);
    }

    function clearDragState() {
        draggingId = null;
        dragTargetId = null;
        dragStartId = null;
    }

    function stopPointerTracking() {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerCancel);
    }

    function setDragTarget(element: HTMLElement, clientY: number) {
        const id = element.dataset.drilldownSortableId;
        if (!draggingId || !id || draggingId === id) return;

        const rect = element.getBoundingClientRect();
        dragTargetId = id;
        dragPlacement = clientY < rect.top + rect.height / 2 ? "before" : "after";
    }

    function handlePointerDown(event: PointerEvent, item: SettingsDrilldownItem) {
        if (!onReorder || event.button !== 0) return;

        const target = event.target;
        if (!(target instanceof Element) || !target.closest(reorderHandle)) return;

        event.preventDefault();
        dragStartId = rowId(item);
        draggingId = dragStartId;
        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp, { once: true });
        window.addEventListener("pointercancel", handlePointerCancel, { once: true });
    }

    function handlePointerMove(event: PointerEvent) {
        if (!draggingId) return;

        const target = document.elementFromPoint(event.clientX, event.clientY);
        const row = target instanceof Element ? target.closest<HTMLElement>("[data-drilldown-sortable-id]") : null;
        if (!row) {
            dragTargetId = null;
            return;
        }

        setDragTarget(row, event.clientY);
    }

    function handlePointerUp() {
        stopPointerTracking();

        if (!onReorder || !draggingId || !dragTargetId) {
            clearDragState();
            return;
        }

        const ids = items.map(rowId);
        const oldIndex = ids.indexOf(draggingId);
        const targetIndex = ids.indexOf(dragTargetId);

        if (oldIndex === -1 || targetIndex === -1) {
            clearDragState();
            return;
        }

        const targetInsertionIndex = targetIndex + (dragPlacement === "after" ? 1 : 0);
        const newIndex = oldIndex < targetInsertionIndex ? targetInsertionIndex - 1 : targetInsertionIndex;

        if (oldIndex !== newIndex) {
            const orderedIds = ids.filter((id) => id !== draggingId);
            orderedIds.splice(newIndex, 0, draggingId);
            onReorder(oldIndex, newIndex, orderedIds);
        }

        clearDragState();
    }

    function handlePointerCancel() {
        stopPointerTracking();
        clearDragState();
    }

    function handleBack() {
        if (detailItem) onBack?.(detailItem);
        selectedId = null;
    }

    $effect(() => {
        const nextView = selectedItem && detail ? "detail" : "main";
        if (selectedItem) detailItem = selectedItem;
        if (nextView === activeView) return;

        activeView = nextView;
        const timer = setTimeout(() => {
            if (nextView === "main") detailItem = null;
        }, animationTime(300));

        return () => clearTimeout(timer);
    });

    onDestroy(() => {
        stopPointerTracking();
    });
</script>

<div class="flex flex-col">
    <div
        class="settings-slider relative overflow-hidden transition-[height] duration-(--animation-duration-300) ease-out"
        style={sliderHeight ? `height: ${sliderHeight}px;` : undefined}
    >
    <div
        bind:clientHeight={mainHeight}
        class="{activeView === 'main' ? 'relative translate-x-0' : 'pointer-events-none absolute inset-x-0 top-0 -translate-x-full'} transition-transform duration-(--animation-duration-300) ease-out"
    >
        <div class="flex flex-col gap-3">
            {#if items.length || listFooter}
                <div class="bg-(--light-bg1)">
                    {#if items.length}
                    <div bind:this={listElement} role={onReorder ? "list" : undefined}>
                    {#each items as item (item.id)}
                        {@const id = rowId(item)}
                        <div
                            data-drilldown-sortable-item
                            data-drilldown-sortable-id={id}
                            role={onReorder ? "listitem" : undefined}
                            onpointerdown={(event) => handlePointerDown(event, item)}
                            animate:flip={{ duration: animationTime(150) }}
                            style:touch-action={draggingId === id ? "none" : undefined}
                            class="flex items-center border-b border-(--light-bg3) bg-(--light-bg1) transition-[border-color,opacity] duration-(--animation-duration-150) last:border-b-0 hover:bg-(--light-bg2)
                                {draggingId === id ? 'opacity-45' : ''}
                                {dragTargetId === id && dragPlacement === 'before' ? 'border-t-2 border-t-(--user-color)' : ''}
                                {dragTargetId === id && dragPlacement === 'after' ? 'border-b-2 border-b-(--user-color)' : ''}"
                        >
                            <Button
                                variant="ghost"
                                size="md"
                                class="h-auto min-w-0 flex-1 justify-start gap-3 rounded-none px-4 py-2.5 text-left whitespace-normal hover:bg-transparent"
                                onclick={() => (selectedId = item.id)}
                            >
                                {#if itemLeft}
                                    {@render itemLeft(item)}
                                {/if}
                                {#if showItemIcon}
                                    <span class="flex shrink-0 items-center justify-center" style:color={cssColor(item.color, "var(--user-color)")}>
                                        <LucideIcon name={item.icon ?? "Settings"} size={20} strokeWidth={1.6} />
                                    </span>
                                {/if}
                                <span class="min-w-0 flex-1">
                                    <span class="block truncate text-xs font-semibold text-(--dark-bg1)">{item.title}</span>
                                    {#if item.description}
                                        <span class="block truncate text-[10px] font-medium text-(--grey)">{item.description}</span>
                                    {/if}
                                </span>
                            </Button>
                            {#if itemRight}
                                <div class="flex shrink-0 items-center pr-3">
                                    {@render itemRight(item)}
                                </div>
                            {/if}
                            <Button
                                variant="ghost"
                                size="sm"
                                class="mr-2 size-8 w-8 shrink-0 px-0 text-(--grey)"
                                aria-label="Ouvrir"
                                onclick={() => (selectedId = item.id)}
                            >
                                <Icon.ChevronRight size={15} />
                            </Button>
                        </div>
                    {/each}
                    </div>
                    {:else}
                        <div class="px-4 py-5 text-center">
                            <div class="text-xs font-semibold text-(--dark-bg1)">{emptyTitle}</div>
                            {#if emptyDescription}
                                <div class="mt-1 text-[10px] text-(--grey)">{emptyDescription}</div>
                            {/if}
                        </div>
                    {/if}
                    {#if listFooter}
                        {@render listFooter()}
                    {/if}
                </div>
            {:else}
                <div class="px-4 py-5 text-center">
                    <div class="text-xs font-semibold text-(--dark-bg1)">{emptyTitle}</div>
                    {#if emptyDescription}
                        <div class="mt-1 text-[10px] text-(--grey)">{emptyDescription}</div>
                    {/if}
                </div>
            {/if}
        </div>
    </div>

    <div
        bind:clientHeight={detailHeight}
        class="{activeView === 'detail' ? 'relative translate-x-0' : 'pointer-events-none absolute inset-x-0 top-0 translate-x-full'} transition-transform duration-(--animation-duration-300) ease-out"
    >
        {#if detailItem && detail}
            <div class="flex flex-col gap-3">
                <div class="flex items-center justify-between gap-3 px-4 pt-4">
                    <Button
                        variant="ghost"
                        class="group flex p-0 pl-0.5 gap-1.5 text-(--grey) hover:text-(--dark-bg1)"
                        confirm={backConfirm}
                        confirmTitle={backConfirmTitle}
                        confirmDescription={backConfirmDescription}
                        confirmCancelLabel={backConfirmCancelLabel}
                        confirmConfirmLabel={backConfirmConfirmLabel}
                        confirmConfirmVariant="warning"
                        onclick={handleBack}
                    >
                        <Icon.MoveLeft size={15} class="transition-transform duration-(--animation-duration-150) group-hover:-translate-x-0.5" />
                        <span class="truncate">{backLabel ?? detailItem.title}</span>
                    </Button>

                    {#if detailRight}
                        {@render detailRight(detailItem)}
                    {/if}
                </div>
                {@render detail(detailItem)}
            </div>
        {/if}
        </div>
    </div>

    {#if actions && selectedItem}
        <div class="bg-linear-to-t from-(--light-bg1) from-70% to-transparent px-4 pt-6 pb-4">
            <div class="flex items-center justify-end gap-2">
                {@render actions(selectedItem)}
            </div>
        </div>
    {/if}
</div>
