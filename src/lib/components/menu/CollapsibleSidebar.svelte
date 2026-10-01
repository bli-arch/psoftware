<script lang="ts">
    import type { Snippet } from "svelte";
    import { Button } from "bits-ui";
    import { getSidebarState } from "./sidebarState";
    import * as Icon from "lucide-svelte";

    type Props = {
        id: string;
        side?: "left" | "right";
        width?: string;
        collapsedWidth?: string;
        class?: string;
        children?: Snippet<[{ collapsed: boolean; onToggle: () => void }]>;
    };

    let {
        id,
        side = "right",
        width = "420px",
        collapsedWidth = "64px",
        class: className = "",
        children,
    }: Props = $props();

    function createSidebarState() {
        return getSidebarState(id);
    }

    const { collapsed, toggle } = createSidebarState();
    const onToggle = toggle;
    const isRight = $derived(side === "right");
    const isCollapsed = $derived($collapsed);
</script>

<aside
    class="group/sidebar-container relative z-10 h-full shrink-0 bg-(--light-bg1) transition-all duration-(--animation-duration) {isRight ? 'border-l' : 'border-r'} border-(--light-bg3) {className}"
    style="width: {isCollapsed ? collapsedWidth : width}; min-width: {isCollapsed ? collapsedWidth : width};"
>
    <Button.Root
        onclick={onToggle}
        aria-pressed={isCollapsed}
        class="absolute top-1/2 z-50 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-(--light-bg3) bg-(--light-bg1) text-(--grey) opacity-0 transition-all duration-(--animation-duration) delay-(--animation-delay-300) hover:text-(--dark-bg1) group-hover/sidebar-container:opacity-100 group-hover/sidebar-container:delay-0 {isRight ? '-left-3' : '-right-3'}"
    >
        <Icon.ChevronRight
            size={12}
            class="transition-transform duration-(--animation-duration) {isRight ? (isCollapsed ? 'rotate-180' : 'rotate-0') : (isCollapsed ? 'rotate-0' : 'rotate-180')}"
        />
    </Button.Root>

    <div class="h-full w-full overflow-hidden">
        {@render children?.({ collapsed: isCollapsed, onToggle })}
    </div>
</aside>
