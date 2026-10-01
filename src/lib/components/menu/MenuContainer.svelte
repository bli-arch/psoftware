<script lang="ts">
    import { onMount } from "svelte";
    import { afterNavigate, onNavigate } from "$app/navigation";
    import { scale, slide } from "svelte/transition";
    import { delayedClass } from "$lib/utils"; 
    import { animationTime } from "$lib/uiPreferences";
    import { getSidebarState } from "./sidebarState";

    export let id: string;
    let className: string;
    export {className as class};
    
    const { collapsed, toggle } = getSidebarState(id);
    const onToggle = toggle;

    $: isCollapsed = $collapsed;

/* // magnet highlighter
    let container: HTMLElement;
    let highlighter: HTMLElement;
    let navButtons: NodeListOf<HTMLElement>;


    const moveHighlighterToItem = (item: HTMLElement): void => {
        if (!item) return;

        const containerRect = container.getBoundingClientRect();
        const itemRect = item.getBoundingClientRect();
        const topOffset = itemRect.top - containerRect.top;

        // Update the highlighter style based on the target item's properties
        highlighter.style.backgroundColor = '#dfe3e8'//`color-mix(in srgb, ${getComputedStyle(item).color} 8%, transparent)`;
        highlighter.style.transform = `translateY(${topOffset}px)`;
        highlighter.style.height = `${itemRect.height}px`;
        highlighter.style.opacity = "1";
    };

    onMount(() => {
        navButtons = container.querySelectorAll(".nav-button");

        navButtons.forEach((button: HTMLElement) => {
            button.addEventListener("mouseenter", (event: MouseEvent) => {
                highlighter.style.transitionDuration = "";
                moveHighlighterToItem(event.currentTarget as HTMLElement);
            });
        });

        container.addEventListener("mouseleave", () => {
            const activeItem = container.querySelector(
                ".nav-button.--active",
            ) as HTMLElement;
            if (activeItem) {
                moveHighlighterToItem(activeItem);
            } else {
                highlighter.style.opacity = "0";
            }
        });

        const activeItem = container.querySelector(
            ".nav-button.--active",
        ) as HTMLElement;

        if (activeItem) {
            highlighter.style.transitionDuration = "0s";
            moveHighlighterToItem(activeItem);

            const resizeObserver = new ResizeObserver(() => {
                const activeItem = container.querySelector(
                    ".nav-button.--active",
                ) as HTMLElement;
                highlighter.style.transitionDuration = "0s";
                moveHighlighterToItem(activeItem);
            });
            resizeObserver.observe(document.documentElement);
        }
    });

    afterNavigate(() => {
        const activeItem = container.querySelector(
            ".nav-button.--active",
        ) as HTMLElement;

        if (activeItem) {
            highlighter.style.transitionDuration = "var(--animation-duration-150)";
            moveHighlighterToItem(activeItem);
        }
    });
    */
</script>

<!-- Component Template -->
<div
    class="group/sidebar-container z-10 h-full box-border flex gap-5 flex-col items-center border-r-1 border-r-(--light-bg3) p-2.5 bg-(--light-bg1) text-(--dark-bg1) relative max-w-56
    transition-all duration-(--animation-duration) {isCollapsed ? "w-16 min-w-16" : "w-56 min-w-56"} {className}"
    use:delayedClass={{ className: "w-full", delay: animationTime(210), condition: !isCollapsed }}
    
>   
    <!-- bind:this={container} -->
    <div  
        class="w-full h-full z-0 flex flex-col overflow-hidden">
        <slot collapsed={isCollapsed} {onToggle} {...$$restProps}/>
        
        <!-- bind:this={highlighter} -->
        <div
            class="highlighter opacity-100 absolute transition-all duration-(--animation-duration-150) z-[-1] rounded-md top-0 hidden"
            class:w-full={!isCollapsed}
            class:w-11={isCollapsed}
            transition:slide={{ duration: animationTime(150) }}
        ></div>
    </div>
</div>


<style>

    /* 
    CHANGE
        highlighter opacity-100 absolute transition-all duration-(--animation-duration-150) z-[-1] rounded-md top-0 hidden 
    TO
        highlighter opacity-100 absolute transition-all duration-(--animation-duration-150) z-[-1] rounded-md top-0
    TO ACTIVATE MAGNETIC HIGHLIGHTER
    */

    :global(.nav-button) {
        transition: transform var(--animation-duration-150) ease;
        position: relative;
    }

    :global(.nav-button:before) {
        content: "";
        opacity: 0;
        position: absolute;
        left: 0;
        background: var(--light-bg3);
        width: 100%;
        height: 100%;
        border-radius: 8px;
        /* transition: all var(--animation-duration-150) ease, translate var(--animation-duration-250) cubic-bezier(0.3, -0.2, 0.3, 2); */
        transition: all var(--animation-duration-150) ease, translate var(--animation-duration-750) linear(0 0%, 0.22 2.1%, 0.86 6.5%, 1.11 8.6%, 1.3 10.7%, 1.35 11.8%, 1.37 12.9%, 1.37 13.7%, 1.36 14.5%, 1.32 16.2%, 1.03 21.8%, 0.94 24%, 0.89 25.9%, 0.88 26.85%, 0.87 27.8%, 0.87 29.25%, 0.88 30.7%, 0.91 32.4%, 0.98 36.4%, 1.01 38.3%, 1.04 40.5%, 1.05 42.7%, 1.05 44.1%, 1.04 45.7%, 1 53.3%, 0.99 55.4%, 0.98 57.5%, 0.99 60.7%, 1 68.1%, 1.01 72.2%, 1 86.7%, 1 100%);
        transform: scale(0.6);
        translate: 0 40%;
        z-index: -1
    }

    :global(.nav-button.--active):before{
        opacity: 1;
        transform: scale(1);
        translate: 0 0;
    }

    :global(.nav-button.--danger:before) {
        background: var(--transparent-red);
    }

    :global(.nav-button:hover:before) {
        opacity: 1;
        transform: scale(1);
        translate: 0 0;
    }
</style>
