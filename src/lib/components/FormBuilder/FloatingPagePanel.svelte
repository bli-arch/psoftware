<script lang="ts">
    import { onMount, tick } from "svelte";
    import { Accordion } from "bits-ui";
    import * as Icon from "lucide-svelte";
    import MyAccordion from "$lib/components/MyAccordion.svelte";
    import { Badge } from "$lib/components/Badge";
    import { Button } from "$lib/components/istyler";
    import { placeFloatingPanel, registerFloatingPanel, unregisterFloatingPanel } from "$lib/components/floatingPanel";
    import InlineTextEdit from "./InlineTextEdit.svelte";
    import { currentPage, pages, type Page } from "./stores";

    let {
        formName = $bindable(""),
        saved = true,
        positionKey = "formbuilder-page-panel",
        layerKey = "formbuilder-floating-panels",
        rememberPosition = true,
        initialX = 24,
        initialY = 24,
        onBack
    }: {
        formName?: string;
        saved?: boolean;
        positionKey?: string;
        layerKey?: string;
        rememberPosition?: boolean;
        initialX?: number;
        initialY?: number;
        onBack: () => void | Promise<void>;
    } = $props();

    const margin = 12;
    const panelValue = "formbuilder-pages";
    let panel: HTMLElement;
    let x = $state(initialX);
    let y = $state(initialY);
    let dragging = $state(false);
    let open = $state(true);
    let offset = { x: 0, y: 0 };
    let page = $derived($pages[$currentPage]);
    let openItems = $derived(open ? [panelValue] : []);
    let currentInputCount = $derived($pages[$currentPage]?.items.length ?? 0);

    const panelId = $derived(positionKey || "formbuilder-page-panel");
    const storageKey = $derived(positionKey ? `psoft.panel.${positionKey}.position` : "");

    function moveTo(nextX: number, nextY: number) {
        const width = panel?.offsetWidth ?? 320;
        const height = panel?.offsetHeight ?? 360;
        const position = placeFloatingPanel({
            id: panelId,
            layer: layerKey,
            x: nextX,
            y: nextY,
            previousX: x,
            previousY: y,
            width,
            height,
            margin
        });

        x = position.x;
        y = position.y;
        registerFloatingPanel({ id: panelId, layer: layerKey, x, y, width, height });
    }

    function startDrag(event: PointerEvent) {
        if ((event.target as HTMLElement).closest("[data-panel-action]")) return;

        const rect = panel.getBoundingClientRect();
        dragging = true;
        offset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    }

    function drag(event: PointerEvent) {
        if (dragging) moveTo(event.clientX - offset.x, event.clientY - offset.y);
    }

    function stopDrag() {
        if (!dragging) return;
        dragging = false;
        savePosition();
    }

    async function setAccordionValue(value: string[]) {
        open = value.includes(panelValue);
        await tick();
        moveTo(x, y);
    }

    function blockNativeDrag(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
    }

    function readPosition() {
        if (!rememberPosition || !storageKey) return { x: initialX, y: initialY };

        try {
            const value = JSON.parse(localStorage.getItem(storageKey) ?? "null");
            return Number.isFinite(value?.x) && Number.isFinite(value?.y)
                ? { x: value.x, y: value.y }
                : { x: initialX, y: initialY };
        } catch {
            return { x: initialX, y: initialY };
        }
    }

    function savePosition() {
        if (!rememberPosition || !storageKey) return;

        try {
            localStorage.setItem(storageKey, JSON.stringify({ x, y }));
        } catch {
            // Local storage can be unavailable in restricted environments.
        }
    }

    function updatePage(patch: Partial<Pick<Page, "title" | "description">>) {
        pages.update((list) =>
            list.map((item, index) => index === $currentPage ? { ...item, ...patch } : item)
        );
    }

    function updatePageText(key: "title" | "description", event: Event) {
        updatePage({ [key]: (event.currentTarget as HTMLInputElement).value });
    }

    function addPage() {
        pages.update((list) => {
            const next = [...list, { title: "", description: "", icon: "ClipboardList", type: "data", items: [] } satisfies Page];
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
    }

    function pageTitle(item: Page, index: number) {
        return item.title.trim() || `Page ${index + 1}`;
    }

    onMount(() => {
        const contain = () => moveTo(x, y);
        const position = readPosition();

        moveTo(position.x, position.y);
        window.addEventListener("resize", contain);

        return () => {
            window.removeEventListener("resize", contain);
            unregisterFloatingPanel(panelId);
        };
    });
</script>

<div
    bind:this={panel}
    role="presentation"
    class="fixed z-[60] max-h-[calc(100vh-24px)] w-100 overflow-hidden rounded-xl text-(--dark-bg1) shadow-(--shadow-popover) transition-shadow duration-(--animation-duration) {dragging ? 'shadow-xl' : ''}"
    style={`left: ${x}px; top: ${y}px;`}
    draggable="false"
    ondragstart={blockNativeDrag}
    ondragenter={blockNativeDrag}
    ondragover={blockNativeDrag}
    ondrop={blockNativeDrag}
>
    <Accordion.Root
        type="multiple"
        value={openItems}
        onValueChange={setAccordionValue}
        class="settings-accordion"
    >
        <Accordion.Item value={panelValue} class="settings-accordion-item overflow-hidden rounded-xl border border-(--light-bg3) bg-(--light-bg1)">
            <Accordion.Header>
                <div class="flex items-center gap-3 px-3 py-2">
                    <Button
                        variant="ghost"
                        icon="SquareScissors"
                        class="h-8! w-8! shrink-0 px-2! text-(--dark-bg1) hover:bg-(--light-bg2)"
                        data-panel-action
                        confirm
                        confirmTitle="Retour aux formulaires ?"
                        confirmDescription="Les modifications non enregistrées seront perdues."
                        confirmCancelLabel="annuler"
                        confirmConfirmLabel="Retour"
                        onclick={onBack}
                    />

                    <div class="min-w-0 flex-1">
                        <div class="flex justify-between min-w-0 items-center gap-2">
                            <InlineTextEdit
                                class="h-auto! min-h-8! w-full! overflow-hidden px-0! font-(family-name:--font) text-sm font-semibold text-(--dark-bg1)"
                                aria-label="Nom du formulaire"
                                placeholder="Nom du formulaire"
                                bind:value={formName}
                                data-panel-action
                            />
                            <Badge
                                text={saved ? "Enregistré" : "Non enregistré"}
                                type={saved ? "success" : "warning"}
                                class="shrink-0"
                            />
                        </div>
                    </div>

                    <button
                        type="button"
                        class="flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md text-(--grey)
                            hover:bg-(--light-bg2) hover:text-(--dark-bg1) active:cursor-grabbing"
                        aria-label="Déplacer le panneau"
                        onpointerdown={startDrag}
                        onpointermove={drag}
                        onpointerup={stopDrag}
                        onpointercancel={stopDrag}
                    >
                        <Icon.EllipsisVertical size={16} />
                    </button>

                    <Accordion.Trigger
                        data-panel-action
                        class="flex size-8 shrink-0 items-center justify-center rounded-md text-(--grey) cursor-pointer
                            hover:bg-(--light-bg2) hover:text-(--dark-bg1)"
                        aria-label={open ? "Replier le panneau" : "Déplier le panneau"}
                    >
                        <Icon.ChevronDown
                            size={15}
                            class="transition-transform duration-(--animation-duration) {open ? 'rotate-180' : ''}"
                        />
                    </Accordion.Trigger>
                </div>
            </Accordion.Header>

            <MyAccordion class="settings-accordion-content">
                <div class="flex min-h-0 flex-col gap-3 p-3">
                    <div class="flex flex-col">
                        {#if page}
                            <InlineTextEdit
                                class="h-auto! min-h-8! w-full! px-0! font-(family-name:--font) text-base font-extrabold text-(--dark-bg1)"
                                aria-label="Titre de la page"
                                placeholder="Titre"
                                value={page.title}
                                oninput={(event: Event) => updatePageText("title", event)}
                            />
                            <InlineTextEdit
                                class="h-auto! min-h-8! w-full! px-0! font-(family-name:--font) text-xs font-normal text-(--grey)"
                                aria-label="Description de la page"
                                placeholder="Description"
                                value={page.description}
                                oninput={(event: Event) => updatePageText("description", event)}
                            />
                        {/if}

                        <div class="mt-3 flex flex-wrap gap-1.5">
                            <Badge text={`${currentInputCount} champ${currentInputCount > 1 ? "s" : ""}`} type="neutral" />
                        </div>
                    </div>

                    <div class="flex items-center justify-between">
                        <span class="font-(family-name:--font) text-xs font-semibold uppercase tracking-wider text-(--grey) leading-6">
                            Pages
                        </span>
                        <Button variant="secondary" size="xs" icon="Plus" label="Ajouter" class="w-fit px-2" onclick={addPage} />
                    </div>

                    <div class="flex max-h-48 flex-col gap-1 overflow-y-auto">
                        {#each $pages as item, index}
                            {@const active = index === $currentPage}
                            <div class="group flex items-center gap-1 rounded-lg transition-colors
                                {active ? 'border-(--light-bg3) bg-(--light-bg3)' : 'text-(--dark-bg1) hover:bg-(--light-bg2)/60'}">
                                <button
                                    type="button"
                                    class="flex cursor-pointer min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left font-(family-name:--font) text-xs text-(--dark-bg1)"
                                    onclick={() => currentPage.set(index)}
                                >
                                    <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-(--light-bg3) bg-(--light-bg1)">
                                        {index + 1}
                                    </span>
                                    <span class="truncate">{pageTitle(item, index)}</span>
                                </button>

                                {#if $pages.length > 1}
                                    <Button
                                        variant="ghost"
                                        icon="Trash2"
                                        size="xs"
                                        class="mr-1 h-7! w-7! px-1! text-(--grey) hover:bg-(--transparent-red) hover:text-(--red)"
                                        confirm
                                        confirmTitle="Supprimer cette page ?"
                                        confirmDescription={`La page "${pageTitle(item, index)}" sera supprimée`}
                                        confirmCancelLabel="annuler"
                                        confirmConfirmLabel="Supprimer"
                                        confirmConfirmVariant="error"
                                        onclick={() => deletePage(index)}
                                    >
                                        <span slot="confirmDescription">La page <b>"{pageTitle(item, index)}"</b> sera supprimée</span>
                                    </Button>
                                {/if}
                            </div>
                        {/each}
                    </div>
                </div>
            </MyAccordion>
        </Accordion.Item>
    </Accordion.Root>
</div>
