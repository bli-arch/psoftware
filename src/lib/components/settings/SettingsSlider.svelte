<script lang="ts">
    import type { Snippet } from "svelte";
    import { twMerge } from "tailwind-merge";

    type Props = {
        active?: "main" | "detail";
        main: Snippet;
        detail: Snippet;
        class?: string;
    };

    let {
        active = $bindable("main"),
        main,
        detail,
        class: className = "",
    }: Props = $props();
</script>

<div class={twMerge("settings-slider overflow-hidden", className)}>
    <div class={twMerge("flex w-[200%] transition-transform duration-(--animation-duration-300) ease-out", active === "detail" ? "-translate-x-1/2" : "translate-x-0")}>
        <div class="w-1/2 shrink-0">
            {@render main()}
        </div>
        <div class="w-1/2 shrink-0">
            {@render detail()}
        </div>
    </div>
</div>
