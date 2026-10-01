<script lang="ts">
    import { ContextMenu } from "bits-ui";
    import * as Icon from "lucide-svelte";
    import type { Snippet } from "svelte";

    let {
        onModify,
        onDelete,
        children,
        triggerClass = "size-full",
    }: {
        onModify: () => void;
        onDelete: () => void;
        children?: Snippet;
        triggerClass?: string;
    } = $props();
</script>

<ContextMenu.Root>
    <ContextMenu.Trigger>
        {#snippet child({ props })}
            <div {...props} class={triggerClass}>
                {@render children?.()}
            </div>
        {/snippet}
    </ContextMenu.Trigger>

    <ContextMenu.Portal>
        <ContextMenu.Content class="z-(--z-overlay) w-56 overflow-hidden rounded-xl bg-(--light-bg1) p-1 shadow-lg">
            <ContextMenu.Item
                class="nav-button isolate flex h-9 w-full cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-(--dark-bg1) outline-none"
                onSelect={onModify}
                textValue="Modifier"
            >
                <Icon.Pen size="20" class="min-w-5" />
                <span>Modifier</span>
            </ContextMenu.Item>
            <ContextMenu.Item
                class="nav-button isolate flex h-9 w-full cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium --danger text-(--red) outline-none"
                onSelect={onDelete}
                textValue="Supprimer"
            >
                <Icon.Trash2 size="20" class="min-w-5" />
                <span>Supprimer</span>
            </ContextMenu.Item>
        </ContextMenu.Content>
    </ContextMenu.Portal>
</ContextMenu.Root>
