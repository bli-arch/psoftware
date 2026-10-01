<script lang="ts">
    import { Check } from "lucide-svelte";

    type StepProgressStep = { id: string | number; label: string };

    let {
        steps = [],
        activeIndex = 0,
        onSelect
    }: {
        steps?: StepProgressStep[];
        activeIndex?: number;
        onSelect?: (index: number) => void | Promise<void>;
    } = $props();
</script>

<div class="flex w-full min-w-0 items-center overflow-x-auto sm:w-auto">
    {#each steps as step, index (step.id)}
        <button
            type="button"
            class={`flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap text-xs transition-colors duration-(--animation-duration) ${
                index === activeIndex
                    ? "font-medium text-(--dark-bg1)"
                    : index < activeIndex
                        ? "text-(--user-color)"
                        : "text-(--grey)"
            }`}
            onclick={() => onSelect?.(index)}
        >
            <div
                class={`flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    index === activeIndex
                        ? "bg-(--dark-bg1) text-(--light-bg1)"
                        : index < activeIndex
                            ? "bg-(--user-color)/10 text-(--user-color)"
                            : "bg-(--light-bg3) text-(--grey)"
                }`}
            >
                {#if index < activeIndex}
                    <Check size="10" />
                {:else}
                    {index + 1}
                {/if}
            </div>
            <span>{step.label}</span>
        </button>

        {#if index < steps.length - 1}
            <div
                class={`mx-0.5 h-px w-6 shrink-0 ${
                    index < activeIndex ? "bg-(--user-color)/40" : "bg-(--light-bg3)"
                }`}
            ></div>
        {/if}
    {/each}
</div>
