<script lang="ts">
    import { Dialog } from "bits-ui";
    import { toast } from "svelte-sonner";
    import MyDialog from "$lib/components/MyDialog.svelte";
    import { Button, Textarea } from "$lib/components/istyler";
    import { requestPrint } from "$lib/printing";

    type Props = {
        title: string;
        description: string;
        source?: `/${string}`;
        load?: () => Promise<string>;
        value?: string;
        triggerLabel?: string;
        triggerIcon?: string | null;
        modifiable?: boolean;
        disabled?: boolean;
        onSave?: (value: string) => void | Promise<void>;
        open?: boolean;
        confirmed?: boolean;
        confirmLabel?: string;
        confirmTitle?: string;
        confirmDescription?: string;
        onConfirm?: () => void | Promise<void>;
    };

    let {
        title,
        description,
        source,
        load,
        value = "",
        triggerLabel = "Ouvrir",
        triggerIcon = "ScrollText",
        modifiable = false,
        disabled = false,
        onSave,
        open = $bindable(false),
        confirmed = false,
        confirmLabel = "Confirmer la notice",
        confirmTitle = "Confirmer cette notice ?",
        confirmDescription = "Je confirme avoir vérifié et adapté cette notice aux traitements de données réellement effectués par l’entreprise.",
        onConfirm,
    }: Props = $props();

    let loading = $state(false);
    let saving = $state(false);
    let confirming = $state(false);
    let editing = $state(false);
    let content = $state("");
    let draftContent = $state("");
    let error = $state("");
    const editable = $derived(modifiable && typeof onSave === "function");
    const hasChanges = $derived(draftContent !== content);

    async function loadContent() {
        loading = true;
        error = "";

        try {
            if (load) {
                content = await load();
            } else if (source) {
                if (!source.startsWith("/")) throw new Error("Only local text files can be opened.");
                const response = await fetch(source, { cache: "no-store" });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                content = await response.text();
            } else {
                content = value;
            }
            draftContent = content;
            editing = false;
        } catch (loadError) {
            console.error(`Failed to load text content: ${source ?? title}`, loadError);
            content = "";
            draftContent = "";
            error = "Impossible de charger ce document.";
        } finally {
            loading = false;
        }
    }

    function startEditing() {
        if (!editable) return;
        error = "";
        draftContent = content;
        editing = true;
    }

    function cancelEditing() {
        draftContent = content;
        error = "";
        editing = false;
    }

    async function saveContent() {
        if (!editable || !onSave || saving || !hasChanges) return;

        saving = true;
        error = "";
        try {
            await onSave(draftContent);
            content = draftContent;
            editing = false;
        } catch (saveError) {
            console.error(`Failed to save text content: ${title}`, saveError);
            error = "Impossible d'enregistrer ce document.";
        } finally {
            saving = false;
        }
    }

    async function confirmContent() {
        if (!onConfirm || confirmed || confirming || !content.trim()) return;

        confirming = true;
        try {
            await onConfirm();
        } catch (confirmError) {
            console.error(`Failed to confirm text content: ${title}`, confirmError);
            toast.error("Impossible de confirmer cette notice.");
        } finally {
            confirming = false;
        }
    }

    function printContent() {
        const printableContent = editing ? draftContent : content;
        if (!requestPrint({
            type: "document",
            mode: "manual",
            kind: "text",
            title,
            description,
            content: printableContent,
        })) {
            toast.error("Impossible de préparer cette impression.");
        }
    }

    $effect(() => {
        if (open) void loadContent();
    });
</script>

<Dialog.Root bind:open>
    <Dialog.Trigger>
        {#snippet child({ props })}
            <Button {...props} type="button" variant="secondary" size="sm" icon={triggerIcon ?? undefined} label={triggerLabel} disabled={disabled || loading || saving || confirming} class="w-fit" />
        {/snippet}
    </Dialog.Trigger>

    <Dialog.Portal>
        <MyDialog class="w-full h-full flex flex-col max-h-none max-w-none rounded-none p-0! bg-(--light-bg1) text-(--dark-bg1)">
            <div class="flex h-full min-h-0 flex-col overflow-hidden">
                <div class="flex h-14 shrink-0 items-center justify-between border-b border-(--light-bg3) bg-(--light-bg1) px-6">
                    <div class="min-w-0">
                        <Dialog.Title class="truncate text-lg font-extrabold text-(--dark-bg1)">
                            {title}
                        </Dialog.Title>
                        <Dialog.Description class="truncate text-sm text-(--grey)">
                            {description}
                        </Dialog.Description>
                    </div>

                    <Dialog.Close>
                        {#snippet child({ props })}
                            <Button {...props} type="button" variant="ghost" icon="X" class="size-8 bg-transparent px-0 hover:bg-(--light-bg3)" />
                        {/snippet}
                    </Dialog.Close>
                </div>

                <div class="min-h-0 flex-1 overflow-auto bg-(--light-bg2) p-6">
                    {#if loading}
                        <div class="flex h-full items-center justify-center text-sm text-(--grey)">Chargement...</div>
                    {:else if error}
                        {#if editable && editing}
                            <div class="flex min-h-full flex-col gap-3">
                                <Textarea
                                    ariaLabel={title}
                                    rows={24}
                                    parentClass="min-h-[30rem]"
                                    bind:value={draftContent}
                                    disabled={saving}
                                />
                                <div class="text-sm text-(--red)">{error}</div>
                            </div>
                        {:else}
                            <div class="flex h-full items-center justify-center text-sm text-(--red)">{error}</div>
                        {/if}
                    {:else}
                        {#if editable && editing}
                            <Textarea
                                ariaLabel={title}
                                rows={24}
                                parentClass="min-h-[30rem]"
                                bind:value={draftContent}
                                disabled={saving}
                            />
                        {:else}
                            <pre class="min-h-full whitespace-pre-wrap rounded-xl border border-(--light-bg3) bg-(--light-bg1) p-5 font-sans text-sm leading-6 text-(--dark-bg1)">{content}</pre>
                        {/if}
                    {/if}
                </div>

                <div class="flex shrink-0 justify-end gap-2 border-t border-(--light-bg3) bg-(--light-bg1) px-6 py-3">
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        icon="Printer"
                        label="Imprimer"
                        disabled={loading || saving || Boolean(error)}
                        class="w-fit"
                        onclick={printContent}
                    />
                    {#if editable}
                        {#if editing}
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                label="Annuler"
                                disabled={saving}
                                class="w-fit"
                                onclick={cancelEditing}
                            />
                            <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                icon={saving ? "LoaderCircle" : "Save"}
                                iconAnimation={saving ? "spin" : undefined}
                                label={saving ? "Enregistrement" : "Enregistrer"}
                                disabled={saving || !hasChanges}
                                class="w-fit"
                                onclick={() => void saveContent()}
                            />
                        {:else}
                            {#if onConfirm && !confirmed}
                                <Button
                                    type="button"
                                    variant="primary"
                                    size="sm"
                                    icon={confirming ? "LoaderCircle" : "ShieldCheck"}
                                    iconAnimation={confirming ? "spin" : undefined}
                                    label={confirming ? "Confirmation" : confirmLabel}
                                    disabled={confirming || !content.trim() || Boolean(error)}
                                    confirm
                                    {confirmTitle}
                                    {confirmDescription}
                                    confirmCancelLabel="Annuler"
                                    confirmConfirmLabel="Confirmer"
                                    class="w-fit"
                                    onclick={() => void confirmContent()}
                                />
                            {/if}
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                icon="Pencil"
                                label="Modifier"
                                class="w-fit"
                                onclick={startEditing}
                            />
                        {/if}
                    {/if}
                </div>
            </div>
        </MyDialog>
    </Dialog.Portal>
</Dialog.Root>
