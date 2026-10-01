<script lang="ts">
    import { Dialog } from "bits-ui";
    import { flip } from "svelte/animate";
    import { slide } from "svelte/transition";
    import MyDialog from "$lib/components/MyDialog.svelte";
    import { Button, TextInput } from "$lib/components/istyler";
    import { animationTime } from "$lib/uiPreferences";

    let {
        open = $bindable(false),
        formName = $bindable(""),
        pageTitles = $bindable(["Appareil", "Devis"]),
        namePlaceholder = "ex. Formulaire Été 2025",
        onCreate
    }: {
        open?: boolean;
        formName?: string;
        pageTitles?: string[];
        namePlaceholder?: string;
        onCreate: () => void;
    } = $props();

    let nextPageId = pageTitles.length;
    let pageIds = $state(pageTitles.map((_, index) => index + 1));

    $effect(() => {
        if (pageIds.length === pageTitles.length) return;
        pageIds = pageTitles.map((_, index) => pageIds[index] ?? ++nextPageId);
    });

    function updatePageTitle(index: number, value: string) {
        pageTitles = pageTitles.map((title, currentIndex) => currentIndex === index ? value : title);
    }

    function updatePageTitleFromInput(event: Event) {
        const input = event.currentTarget as HTMLInputElement;
        updatePageTitle(Number(input.dataset.index), input.value);
    }

    function addPage() {
        pageIds = [...pageIds, ++nextPageId];
        pageTitles = [...pageTitles, ""];
    }

    function removePage(index: number) {
        if (pageTitles.length <= 1) return;
        pageIds = pageIds.filter((_, currentIndex) => currentIndex !== index);
        pageTitles = pageTitles.filter((_, currentIndex) => currentIndex !== index);
    }
</script>

<Dialog.Root bind:open>
    <Dialog.Portal>
        <MyDialog
            class="max-h-[min(40rem,calc(100vh-4rem))]! w-[min(28rem,calc(100vw-2rem))]! rounded-xl"
            layout="sectioned"
            title="Nouveau formulaire"
            description="Donnez un nom et définissez les pages de ce formulaire."
            bodyClass="flex overflow-hidden!"
        >
            {#snippet footer()}
                <Dialog.Close>
                    {#snippet child({ props })}
                        <Button
                            {...props}
                            variant="secondary"
                            size="sm"
                            label="Annuler"
                            class="w-fit px-2.5 font-semibold"
                        />
                    {/snippet}
                </Dialog.Close>

                <Button
                    type="submit"
                    form="create-form-form"
                    size="sm"
                    label="Créer le formulaire"
                    class="w-fit px-2.5 font-semibold"
                />
            {/snippet}

            <form
                id="create-form-form"
                class="flex min-h-0 flex-1 flex-col gap-4"
                onsubmit={(event) => {
                    event.preventDefault();
                    onCreate();
                }}
            >
                <TextInput
                    label="Nom du formulaire"
                    name="modal-form-name"
                    placeholder={namePlaceholder}
                    bind:value={formName}
                />

                <div class="flex min-h-0 flex-1 flex-col">
                    <div class="mb-2 block text-xs font-semibold uppercase tracking-wide text-(--grey)">
                        Pages
                    </div>

                    <div class="min-h-0 flex-1 overflow-y-auto pr-1">
                        <div class="flex flex-col gap-1.5">
                            {#each pageTitles as pageTitle, index (pageIds[index] ?? `pending-${index}`)}
                                <div
                                    class="flex items-center gap-2"
                                    animate:flip={{ duration: animationTime(200) }}
                                    transition:slide={{ duration: animationTime(200) }}
                                >
                                    <div class="flex size-6 shrink-0 flex-center text-sm font-semibold text-(--grey)">
                                        {index + 1}
                                    </div>

                                    <TextInput
                                        name={`modal-page-title-${index}`}
                                        value={pageTitle}
                                        data-index={index}
                                        oninput={updatePageTitleFromInput}
                                        placeholder="Nom de la page"
                                        class="h-9"
                                    />

                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        icon="Trash2"
                                        tooltip="Supprimer la page"
                                        onclick={() => removePage(index)}
                                        disabled={pageTitles.length <= 1}
                                        aria-label="Supprimer la page"
                                        class="size-8 w-8 shrink-0 border border-(--light-bg3) px-0 text-(--red) hover:bg-(--transparent-red)"
                                    />
                                </div>
                            {/each}
                        </div>
                    </div>

                    <Button
                        variant="secondary"
                        size="sm"
                        icon="Plus"
                        onclick={addPage}
                        class="mt-2 h-9 w-full shrink-0 justify-center rounded-lg border-dashed border-(--light-bg3) bg-(--light-bg1)
                            text-sm text-(--grey) hover:border-(--user-color) hover:bg-(--user-color-transparent) hover:text-(--user-color)"
                    >
                        Ajouter une page
                    </Button>
                </div>
            </form>
        </MyDialog>
    </Dialog.Portal>
</Dialog.Root>
