<script lang="ts">
    import { Button } from "../istyler";
    import { FORM_BUILDER_DRAG_TYPE, dragSize, dragType, type Item } from "./stores";

    export let item: Item;

    function onDragStart(event: DragEvent) {
        const payload = JSON.stringify(item);
        dragSize.set(item.size);
        dragType.set(item.type);
        event.dataTransfer?.setData(FORM_BUILDER_DRAG_TYPE, payload);
        event.dataTransfer?.setData("text/plain", payload);
    }

    function onDragEnd() {
        dragType.set(null);
    }
</script>

<Button
    variant="ghost"
    class="min-h-fit min-w-fit h-12! w-16! shrink-0 cursor-grab flex-col! gap-1 rounded-lg px-1! py-1! text-(--dark-bg1)
        hover:bg-(--light-bg2) active:cursor-grabbing active:bg-(--light-bg3)"
    draggable="true"
    ondragstart={onDragStart}
    ondragend={onDragEnd}
>
    <svelte:component this={item.icon} size={20} />
    <span class="max-w-full truncate font-(family-name:--font) text-[11px] leading-none">
        {item.name}
    </span>
</Button>
