<script lang="ts">
    import { onDestroy } from "svelte";
    import * as Icon from "lucide-svelte";
    import { Tooltip } from "bits-ui";
    import MyTooltip from "../MyTooltip.svelte";
    import "./iStyler.css";

    export let label: string | undefined = undefined;
    export let name: string | undefined = undefined;
    export let accept: string | undefined = undefined;
    export let placeholder = "Choisir un fichier";
    export let required = false;
    export let disabled = false;
    export let dropzone = false;
    export let preview = false;
    export let previewUrl: string | null = null;
    export let previewName: string | null = null;
    export let maxSize: number | null = null;
    export let value: File | null = null;
    export let helpText: string | undefined = undefined;
    export let helpTextIcon = false;
    export let onchange: ((file: File | null) => void) | undefined = undefined;
    export let tabindex: number | null | undefined = -1;
    let parentClass = "";
    export { parentClass as class };

    let input: HTMLInputElement;
    let dragging = false;
    let previewFile: File | null = null;
    let filePreviewUrl: string | null = null;
    let activePreviewUrl: string | null = null;
    let displayedName: string | null = null;
    let sizeError = "";

    const isPreviewableImage = (file: File | null) => Boolean(
        file && (file.type.startsWith("image/") || /\.(?:png|jpe?g|webp|svg)$/i.test(file.name)),
    );

    function formatSize(bytes: number) {
        if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} Ko`;
        return `${(bytes / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
    }

    function setFile(file: File | null) {
        if (file && maxSize !== null && file.size > maxSize) {
            value = null;
            sizeError = `Le fichier dépasse la taille maximale autorisée (${formatSize(maxSize)}).`;
            if (input) input.value = "";
            onchange?.(null);
            return;
        }

        sizeError = "";
        value = file;
        onchange?.(file);
    }

    function selectFile(event: Event) {
        setFile((event.currentTarget as HTMLInputElement).files?.[0] ?? null);
    }

    function dragOver(event: DragEvent) {
        if (!dropzone) return;
        event.preventDefault();
        if (!disabled) dragging = true;
    }

    function leaveDropzone(event: DragEvent) {
        const target = event.currentTarget as HTMLElement;
        if (event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) return;
        dragging = false;
    }

    function dropFile(event: DragEvent) {
        if (!dropzone) return;
        event.preventDefault();
        dragging = false;
        if (disabled) return;

        const file = event.dataTransfer?.files[0];
        if (!file) return;

        const files = new DataTransfer();
        files.items.add(file);
        input.files = files.files;
        setFile(file);
    }

    $: if (!value && input?.value) input.value = "";

    $: {
        const nextPreviewFile = preview && isPreviewableImage(value) ? value : null;
        if (nextPreviewFile !== previewFile) {
            if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
            previewFile = nextPreviewFile;
            filePreviewUrl = nextPreviewFile ? URL.createObjectURL(nextPreviewFile) : null;
        }
    }

    $: activePreviewUrl = preview
        ? filePreviewUrl ?? (!value ? previewUrl : null)
        : null;
    $: displayedName = value?.name ?? (!value ? previewName : null);

    onDestroy(() => {
        if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    });
</script>

<div class={`flex w-full flex-col gap-1 ${parentClass}`}>
    {#if label}
        <span class="input-label">
            {label}
            {#if required}
                <Tooltip.Provider>
                    <Tooltip.Root delayDuration={150}>
                        <Tooltip.Trigger>
                            {#snippet child({ props })}
                                <button type="button" class="required-star" {...props} tabindex={tabindex}>
                                    <Icon.Asterisk size={16} fill="var(--red)" />
                                </button>
                            {/snippet}
                        </Tooltip.Trigger>
                        <MyTooltip>Cette donnée est requise</MyTooltip>
                    </Tooltip.Root>
                </Tooltip.Provider>
            {/if}
        </span>
    {/if}

    <label
        class:input-container={!dropzone}
        class:pr-1={!dropzone}
        class:!cursor-pointer={!disabled}
        class:cursor-not-allowed={disabled}
        class={`group ${dropzone ? `flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 text-center transition-colors duration-(--animation-duration-300) ${dragging ? "border-(--user-color) bg-(--user-color-transparent)" : disabled ? "border-(--light-bg3) bg-(--light-bg2) opacity-70" : "border-(--light-bg3) bg-(--light-bg1) hover:border-(--user-color) hover:bg-(--user-color-transparent)"}` : ""}`}
        ondragover={dragOver}
        ondragleave={leaveDropzone}
        ondrop={dropFile}
    >
        {#if dropzone}
            {#if activePreviewUrl}
                <span class="flex w-full items-center justify-start gap-3 text-left">
                   <span class="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-(--light-bg3) bg-(--light-bg1) p-1.5">
                       <img
                           src={activePreviewUrl}
                           alt={displayedName ? `Aperçu de ${displayedName}` : "Aperçu du fichier"}
                           class="size-full object-contain"
                       />
                   </span>
                    <span class="min-w-0 flex-1 truncate text-sm font-medium text-(--dark-bg1)">
                        {displayedName ?? "Fichier sélectionné"}
                   </span>
               </span>
            {:else}
                <span class={`flex size-11 items-center justify-center rounded-xl border bg-(--light-bg1) transition-colors duration-(--animation-duration-300) ${dragging ? "border-(--user-color) text-(--user-color)" : "border-(--light-bg3) text-(--grey) group-hover:border-(--user-color) group-hover:text-(--user-color)"}`}>
                    <Icon.ImageUp size={18} />
                </span>
            {/if}
           {#if !activePreviewUrl}
               <span class={`max-w-full truncate text-sm font-medium transition-colors duration-(--animation-duration-300) ${displayedName ? "text-(--dark-bg1)" : dragging ? "text-(--user-color)" : "text-(--grey) group-hover:text-(--user-color)"}`}>
                   {displayedName ?? placeholder}
               </span>
                <span class={`text-xs text-(--grey) transition-all duration-(--animation-duration-300) ${dragging ? "translate-y-0 opacity-70" : "translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-70 group-focus-within:translate-y-0 group-focus-within:opacity-70"}`}>
                   {dragging ? "Relâchez pour sélectionner le fichier" : "Déposez un fichier ou cliquez pour parcourir"}
               </span>
           {/if}
        {:else}
            <Icon.ImageUp size={16} class="mr-2 shrink-0 text-(--grey)" />
            <span class={`min-w-0 flex-1 truncate ${displayedName ? "text-(--dark-bg1)" : "font-normal text-(--grey)"}`}>
                {displayedName ?? placeholder}
            </span>
            <span class="rounded-md bg-(--light-bg2) px-2 py-1 text-xs font-medium text-(--dark-bg1)">Parcourir</span>
        {/if}
        <input
            bind:this={input}
            class="sr-only"
            type="file"
            {name}
            {accept}
            {required}
            {disabled}
            aria-invalid={Boolean(sizeError)}
            onchange={selectFile}
        />
    </label>

    {#if sizeError}
        <span class="input-help-text text-(--red)" role="alert">{sizeError}</span>
    {/if}
    {#if helpText}
        <span class="input-help-text">
            {#if helpTextIcon}
                <span class="help-icon"><Icon.Info /></span>
            {/if}
            {helpText}
        </span>
    {/if}
</div>
