<script lang="ts">
    import { tick } from "svelte";
    import { twMerge } from "tailwind-merge";
    import { TextInput } from "$lib/components/istyler";

    let {
        value = $bindable(""),
        editing = $bindable(false),
        placeholder = "",
        class: className = "",
        ...restProps
    } = $props();

    const inputName = `inline-edit-${crypto.randomUUID()}`;
    const text = $derived(String(value ?? "").trim());
    const readClass = $derived(twMerge(
        "inline-flex min-h-6 min-w-0 max-w-full cursor-text items-center rounded-lg border border-transparent bg-transparent px-2 text-left transition-colors duration-(--animation-duration) hover:bg-(--light-bg2)",
        className
    ));
    const inputClass = $derived(twMerge(
        "h-auto! min-h-8! min-w-0 max-w-full",
        className,
        "pl-1!"
    ));

    async function focusInput() {
        await tick();
        const input = document.querySelector<HTMLInputElement>(`input[name="${inputName}"]`);
        input?.focus();
        input?.select();
    }

    async function edit() {
        editing = true;
        await focusInput();
    }

    $effect(() => {
        if (editing) void focusInput();
    });

    function close(event?: KeyboardEvent) {
        if (event && event.key !== "Enter" && event.key !== "Escape") return;
        event?.preventDefault();
        editing = false;
    }
</script>

{#if editing}
    <TextInput
        name={inputName}
        class={inputClass}
        {placeholder}
        bind:value
        onblur={() => close()}
        onkeydown={close}
        {...restProps}
    />
{:else}
    <button
        type="button"
        class={readClass}
        ondblclick={edit}
        {...restProps}
    >
        <span class={twMerge("min-w-0 truncate pl-1", !text && "font-normal text-(--grey)")}>
            {text || placeholder}
        </span>
    </button>
{/if}
