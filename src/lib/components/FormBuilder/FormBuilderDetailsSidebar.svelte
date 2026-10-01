<script lang="ts">
    import { Badge } from "$lib/components/Badge";
    import { Button, IconPicker } from "$lib/components/istyler";
    import { CollapsibleSidebar, Menu, NavButton } from "$lib/components/menu";
    import { flip } from "svelte/animate";
    import { tick } from "svelte";
    import { fly } from "svelte/transition";
    import * as Icon from "lucide-svelte";
    import { animationTime } from "$lib/uiPreferences";
    import InlineTextEdit from "./InlineTextEdit.svelte";
    import { currentPage, pages, type Page } from "./stores";

    let {
        formName = $bindable(""),
        saved = true,
        onBack,
        onSaveAndBack
    }: {
        formName?: string;
        saved?: boolean;
        onBack: () => void | Promise<void>;
        onSaveAndBack: () => void | Promise<void>;
    } = $props();

    let page = $derived($pages[$currentPage]);
    let pageCount = $derived($pages.length);
    let currentInputCount = $derived($pages[$currentPage]?.items.length ?? 0);
    let pageMenu: { x: number; y: number; index: number } | null = $state(null);
    let titleEditing = $state(false);

    $effect(() => {
        $currentPage;
        titleEditing = false;
    });

    function updatePage(patch: Partial<Pick<Page, "title" | "description" | "icon" | "iconColor">>) {
        pages.update((list) =>
            list.map((item, index) => index === $currentPage ? { ...item, ...patch } : item)
        );
    }

    function updatePageText(key: "title" | "description", event: Event) {
        updatePage({ [key]: (event.currentTarget as HTMLInputElement).value });
    }

    function addPage() {
        pages.update((list) => {
            const next = [...list, { title: "", description: "", icon: "ClipboardList", iconColor: "--page-icon-user", type: "data", items: [] } satisfies Page];
            currentPage.set(next.length - 1);
            return next;
        });
    }

    function deletePage(index: number) {
        if ($pages.length < 2) return;

        const nextPage = index === $currentPage
            ? Math.max(0, index - 1)
            : $currentPage > index ? $currentPage - 1 : $currentPage;

        pages.update((list) => list.filter((_, pageIndex) => pageIndex !== index));
        currentPage.set(nextPage);
        pageMenu = null;
    }

    function pageTitle(item: Page, index: number) {
        return item.title.trim() || `Page ${index + 1}`;
    }

    function openPageMenu(event: MouseEvent, index: number) {
        event.stopPropagation();
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        pageMenu = {
            x: Math.max(8, Math.min(rect.right - 224, innerWidth - 232)),
            y: Math.max(8, Math.min(rect.bottom + 4, innerHeight - 96)),
            index
        };
    }

    async function renamePage(index: number) {
        currentPage.set(index);
        pageMenu = null;
        await tick();
        titleEditing = true;
    }
</script>

<CollapsibleSidebar
    id="formbuilder-details-sidebar"
    side="left"
    width="320px"
    collapsedWidth="56px"
    class="text-(--dark-bg1)"
>
    {#snippet children({ collapsed })}
        {#if collapsed}
            <div class="flex h-full w-14 flex-col bg-(--light-bg1) text-(--dark-bg1)">

                <Button
                        variant="ghost"
                        class="group size-9 shrink-0 p-0 m-auto mt-3 text-(--grey) hover:bg-(--light-bg2) hover:text-(--dark-bg1)"
                        title="Retour aux formulaires"
                        aria-label="Retour aux formulaires"
                        confirm={!saved}
                        confirmTitle="Retour aux formulaires ?"
                        confirmDescription="Enregistrez vos modifications avant de revenir aux formulaires."
                        confirmCancelLabel="Quitter sans enregistrer"
                        confirmCancelVariant="error"
                        onConfirmCancel={onBack}
                        confirmConfirmLabel="Enregistrer"
                        onclick={saved ? onBack : onSaveAndBack}
                    >
                        <Icon.ChevronLeft size={15} class="transition-transform duration-(--animation-duration-150) group-hover:-translate-x-0.5" />
                    </Button>

                <div class="flex shrink-0 flex-col items-center gap-2 px-2 py-3">
                    <span class="size-2 shrink-0 rounded-full {saved ? 'bg-(--green)' : 'bg-(--orange)'}"></span>

                    {#if page}
                        <IconPicker
                            value={page.icon ?? "ClipboardList"}
                            allowDeselect={false}
                            showColors
                            toneBackground
                            color={page.iconColor ?? "--page-icon-user"}
                            class="size-9! rounded-xl"
                            onSelect={(icon) => updatePage({ icon })}
                            onColorSelect={(iconColor) => updatePage({ iconColor })}
                        />
                    {/if}
                </div>

                <div class="flex min-h-0 flex-1 flex-col items-center gap-2 border-t border-(--light-bg3) bg-(--light-bg2) px-2 py-3">
                    <div class="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto">
                        {#each $pages as item, index (index)}
                            {@const active = index === $currentPage}
                            <button
                                type="button"
                                title={pageTitle(item, index)}
                                animate:flip={{ duration: animationTime(200) }}
                                in:fly={{ y: 8, duration: animationTime(), delay: animationTime(50) }}
                                out:fly={{ x: -8, duration: animationTime(150) }}
                                class="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-xs font-semibold transition-colors duration-(--animation-duration-150)
                                    {active ? 'bg-(--user-color)/10 text-(--user-color)' : 'text-(--grey) hover:bg-(--light-bg1) hover:text-(--dark-bg1)'}"
                                onclick={() => currentPage.set(index)}
                            >
                                {index + 1}
                            </button>
                        {/each}
                    </div>

                    <div class="flex shrink-0 flex-col items-center gap-1 text-(--grey)">
                        <div class="flex h-7 w-9 items-center justify-center gap-0.5 rounded-md bg-(--dark-bg1)/5 text-xs font-semibold">
                            <Icon.FileText size={12} />
                            {pageCount}
                        </div>
                        <div class="flex h-7 w-9 items-center justify-center gap-0.5 rounded-md bg-(--dark-bg1)/5 text-xs font-semibold">
                            <Icon.List size={12} />
                            {currentInputCount}
                        </div>
                    </div>

                    <Button variant="secondary" size="xs" icon="Plus" class="h-8! w-8! px-1!" onclick={addPage} />
                </div>
            </div>
        {:else}
<div class="flex h-full w-80 shrink-0 flex-col bg-(--light-bg1) text-(--dark-bg1)">
    <div class="flex items-center gap-2 border-b border-(--light-bg3) px-3 py-2">

        <Button 
            variant="ghost"
            class="group size-8 shrink-0 p-0 text-(--grey) hover:bg-(--light-bg2) hover:text-(--dark-bg1)"
            title="Retour aux formulaires"
            aria-label="Retour aux formulaires"
            confirm={!saved}
            confirmTitle="Retour aux formulaires ?"
            confirmDescription="Enregistrez vos modifications avant de revenir aux formulaires."
            confirmCancelLabel="Quitter sans enregistrer"
            confirmCancelVariant="error"
            onConfirmCancel={onBack}
            confirmConfirmLabel="Enregistrer"
            onclick={saved ? onBack : onSaveAndBack}
        >
            <Icon.ChevronLeft size={15} class="transition-transform duration-(--animation-duration-150) group-hover:-translate-x-0.5" />
        </Button>

        <InlineTextEdit
            class="h-auto! min-h-8! w-full! overflow-hidden px-0! font-(family-name:--font) text-sm font-semibold text-(--dark-bg1)"
            aria-label="Nom du formulaire"
            placeholder="Nom du formulaire"
            bind:value={formName}
        />

        <Badge
            text={saved ? "Enregistré" : "Non enregistré"}
            type={saved ? "success" : "warning"}
            class="shrink-0"
        />
    </div>

    <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pt-3">
        <div class="flex flex-col px-3">
            {#if page}
                <div class="bg-(--light-bg1) py-3">
                    <div class="flex min-w-0 items-start gap-3">
                        <IconPicker
                            value={page.icon ?? "ClipboardList"}
                            allowDeselect={false}
                            showColors
                            toneBackground
                            color={page.iconColor ?? "--page-icon-user"}
                            class="size-10! rounded-xl"
                            onSelect={(icon) => updatePage({ icon })}
                            onColorSelect={(iconColor) => updatePage({ iconColor })}
                        />
                        <div class="min-w-0 flex-1">
                            <InlineTextEdit
                                bind:editing={titleEditing}
                                class="h-auto! min-h-6! w-full! px-0! font-(family-name:--font) text-base font-semibold leading-tight text-(--dark-bg1)"
                                aria-label="Titre de la page"
                                placeholder="Titre"
                                value={page.title}
                                oninput={(event: Event) => updatePageText("title", event)}
                            />
                            <InlineTextEdit
                                class="mt-0.5 h-auto! min-h-5! w-full! px-0! font-(family-name:--font) text-sm font-normal leading-5 text-(--grey)"
                                aria-label="Description de la page"
                                placeholder="Description"
                                value={page.description}
                                oninput={(event: Event) => updatePageText("description", event)}
                            />
                        </div>
                    </div>
                </div>
            {/if}

            <div class="flex flex-wrap gap-1.5">
                <Badge
                    icon="FileText"
                    text={`${pageCount} page${pageCount > 1 ? "s" : ""}`}
                    type="ghost"
                    class="bg-(--dark-bg1)/5"
                />
                <Badge
                    icon="List"
                    text={`${currentInputCount} champ${currentInputCount > 1 ? "s" : ""}`}
                    type="ghost"
                    class="bg-(--dark-bg1)/5"
                />
            </div>
        </div>

        <div class="flex flex-col h-full gap-2 p-3 bg-(--light-bg2) border-t border-(--light-bg3)">
            <div class="flex items-center justify-between">
                <span class="font-(family-name:--font) text-xs font-semibold uppercase tracking-wider text-(--grey) leading-6">
                    Pages
                </span>
                <Button variant="secondary" size="xs" icon="Plus" label="Ajouter" class="w-fit px-2" onclick={addPage} />
            </div>

            <div class="flex min-h-0 flex-col gap-1 overflow-y-auto">
                {#each $pages as item, index (index)}
                    {@const active = index === $currentPage}
                    <div
                        animate:flip={{ duration: animationTime(200) }}
                        in:fly={{ y: 8, duration: animationTime(), delay: animationTime(50) }}
                        out:fly={{ x: -8, duration: animationTime(150) }}
                        class="group flex items-center gap-1 rounded-lg border px-1 transition-colors duration-(--animation-duration-150)
                            {active ? 'border-(--user-color)/80 bg-(--user-color)/10' : 'border-transparent bg-transparent hover:border-(--light-bg3) hover:bg-(--light-bg1)'}"
                    >
                        <button
                            type="button"
                            class="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left font-(family-name:--font) text-xs text-(--dark-bg1)"
                            onclick={() => currentPage.set(index)}
                        >
                            <span class="w-5 shrink-0 text-center text-sm font-semibold text-(--grey)">
                                {index + 1}
                            </span>
                            <span class="truncate text-sm font-medium">{pageTitle(item, index)}</span>
                        </button>

                        {#if $pages.length > 1}
                            <Button
                                variant="ghost"
                                icon="EllipsisVertical"
                                size="xs"
                                class="mr-1 h-7! w-7! px-1! text-(--grey) hover:bg-(--light-bg2) hover:text-(--dark-bg1)"
                                aria-label="Actions de page"
                                onclick={(event: MouseEvent) => openPageMenu(event, index)}
                            />
                        {/if}
                    </div>
                {/each}
            </div>
        </div>
    </div>
</div>
        {/if}
    {/snippet}
</CollapsibleSidebar>

{#if pageMenu}
    <div class="fixed inset-0 z-30" role="presentation" onclick={() => pageMenu = null}></div>
    <div
        class="fixed z-40 w-56 overflow-hidden rounded-xl bg-(--light-bg1) p-1 shadow-lg"
        style="left:{pageMenu.x}px; top:{pageMenu.y}px;"
        role="menu"
        tabindex="-1"
        onclick={(event) => event.stopPropagation()}
        onkeydown={(event) => event.stopPropagation()}
    >
        <Menu>
            <NavButton role="menuitem" title="Renommer" onclick={() => renamePage(pageMenu!.index)}>
                <Icon.PenLine size="20" class="min-w-5" />
            </NavButton>
            <NavButton
                role="menuitem"
                title="Supprimer"
                variant="danger"
                confirm
                confirmTitle="Supprimer cette page ?"
                confirmDescription={`La page "${pageTitle($pages[pageMenu.index], pageMenu.index)}" sera supprimée`}
                confirmCancelLabel="Annuler"
                confirmConfirmLabel="Supprimer"
                confirmConfirmVariant="error"
                onclick={() => deletePage(pageMenu!.index)}
            >
                <Icon.Trash2 size="20" class="min-w-5" />
                <span slot="confirmDescription">La page <b>"{pageTitle($pages[pageMenu.index], pageMenu.index)}"</b> sera supprimée</span>
            </NavButton>
        </Menu>
    </div>
{/if}
