<script lang="ts">
    import { FormCanvas } from "$lib/components/FormBuilder";
    import { inputTypesMapping, type InputType } from "$lib/components/istyler";

    let {
        page,
        data = $bindable({}),
        fill = false
    }: {
        page: any;
        data?: Record<string, any>;
        fill?: boolean;
    } = $props();

    const wrapperClass = $derived(
        `mx-auto w-full max-w-7xl overflow-x-hidden${fill ? " min-h-0 flex-1" : ""}`
    );
</script>

<div class="mb-6">
    <h1 class="font-(family-name:--font) text-2xl font-bold tracking-tight text-(--dark-bg1)">{page.title}</h1>
    <p class="text-sm leading-6 text-(--grey)">{page.description}</p>
</div>

<div class={wrapperClass}>
    <FormCanvas fields={page.formFields}>
        {#snippet children({ field })}
            {@const InputComponent = inputTypesMapping[field.config.type as InputType]}
            {#if InputComponent}
                <InputComponent {...field.config} bind:value={data[field.config.name]} />
            {/if}
        {/snippet}
    </FormCanvas>
</div>
