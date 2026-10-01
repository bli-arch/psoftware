<script lang="ts">
    import { get, writable } from "svelte/store";
    import { tick } from "svelte";
    import { slide } from "svelte/transition";
    import { Drawer } from "vaul-svelte";
    import { animationTime } from "$lib/uiPreferences";
    import { FormSettingsMenu } from "./index";
    import { fieldSchema, type FieldSchemaEntry } from "./fieldSchema";
    import type { ManagedFormType } from "./formManagerTypes";
    import { currentPage, pages, type DroppedItem } from "./stores";
    import FormBuilderDropZone from "./FormBuilderDropZone.svelte";
    import { groupFieldsFromItems, groupPreviewValue, schemaWithDefaults } from "./builderFieldUtils";

    const items = writable<DroppedItem[]>(get(pages)[0]?.items ?? []);

    export let formType: ManagedFormType = "operation";

    const editCtx = writable<{
        id: string;
        type: DroppedItem["type"];
        schema: FieldSchemaEntry[];
    } | null>(null);

    let editOpen = false;
    let editCloseTimer: ReturnType<typeof setTimeout> | null = null;
    let editCloseButton: HTMLButtonElement | undefined;

    currentPage.subscribe((index) => {
        const all = get(pages);
        items.set(all[index]?.items ?? []);
    });

    items.subscribe((arr) => {
        pages.update((p) => {
            const idx = get(currentPage);
            if (p[idx]) p[idx].items = arr;
            return p;
        });
    });

    function findItem(list: DroppedItem[], id: string): DroppedItem | null {
        for (const item of list) {
            if (item.id === id) return item;
            const nested = findItem(item.items ?? [], id);
            if (nested) return nested;
        }

        return null;
    }

    function stripNestedDisplayProps(props: Record<string, unknown>) {
        const { clientIdentityRole, displayValue, operationDisplay, receiptDisplay, receiptLabel, receiptFormat, receiptOrder, ...rest } = props;
        return rest;
    }

    function clearDuplicateIdentityRole(list: DroppedItem[], id: string, role: unknown): DroppedItem[] {
        if (typeof role !== "string" || !role) return list;
        const rolesToClear = role === "fullName"
            ? ["fullName", "firstName", "lastName"]
            : role === "firstName" || role === "lastName"
                ? [role, "fullName"]
                : [role];

        return list.map((item) => {
            let props = item.props;
            if (item.id !== id && rolesToClear.includes(props?.clientIdentityRole)) {
                const { clientIdentityRole: _role, ...rest } = props;
                props = rest;
            }

            return {
                ...item,
                ...(props !== item.props ? { props } : {}),
                ...(item.items?.length ? { items: clearDuplicateIdentityRole(item.items, id, role) } : {}),
            };
        });
    }

    function patchItemProps(list: DroppedItem[], id: string, patch: Record<string, unknown>, nested = false): DroppedItem[] {
        return list.map((item) => {
            if (item.id === id) {
                const props = { ...(item.props ?? {}), ...patch };
                return { ...item, props: nested ? stripNestedDisplayProps(props) : props };
            }

            if (item.items?.length) {
                return { ...item, items: patchItemProps(item.items, id, patch, true) };
            }

            return item;
        });
    }

    async function openEdit(item: DroppedItem, schema: FieldSchemaEntry[] = fieldSchema[item.type] ?? []) {
        clearEditCloseTimer();
        editOpen = false;
        editCtx.set({ id: item.id, type: item.type, schema });

        await tick();
        editOpen = true;
    }

    function clearEditCloseTimer() {
        if (!editCloseTimer) return;
        clearTimeout(editCloseTimer);
        editCloseTimer = null;
    }

    function scheduleEditClear() {
        clearEditCloseTimer();
        editCloseTimer = setTimeout(() => {
            editOpen = false;
            editCtx.set(null);
            editCloseTimer = null;
        }, animationTime(300));
    }

    function requestCloseEdit() {
        editCloseButton?.click();
    }

    function handleEditOpenChange(open: boolean) {
        if (!open) scheduleEditClear();
    }

    function updateItem(id: string, patch: Record<string, unknown>) {
        if (typeof patch.clientIdentityRole === "string" && patch.clientIdentityRole) {
            const activePage = get(currentPage);
            pages.update((allPages) => allPages.map((page, index) => index === activePage
                ? page
                : { ...page, items: clearDuplicateIdentityRole(page.items ?? [], id, patch.clientIdentityRole) }));
        }
        items.update((arr) => patchItemProps(clearDuplicateIdentityRole(arr, id, patch.clientIdentityRole), id, patch));
    }

    $: editItem = $editCtx ? findItem($items, $editCtx.id) : null;
    $: editPreviewProps = editItem?.type === "dynamicgroup"
        ? (() => {
            const fields = groupFieldsFromItems(editItem.items ?? []);
            const props = schemaWithDefaults(editItem.type, editItem.props ?? {});
            return {
                fields,
                value: groupPreviewValue(props, fields),
            };
        })()
        : {};
</script>

<FormBuilderDropZone
    items={$items}
    updateItems={(nextItems) => items.set(nextItems)}
    {openEdit}
/>

{#if $editCtx}
    <Drawer.Root
        open={editOpen}
        direction="right"
        closeThreshold={0}
        closeOnOutsideClick={false}
        onOpenChange={handleEditOpenChange}
        onClose={scheduleEditClear}
    >
        <Drawer.Overlay class="fixed inset-0 z-(--z-overlay) bg-black/40" />
        <Drawer.Content
            class="fixed inset-y-0 right-0 z-(--z-overlay) h-full! w-128 max-w-full border-l border-(--light-bg3) bg-(--light-bg1) text-(--dark-bg1) shadow-(--shadow-popover) outline-none! select-text!"
            data-vaul-no-drag
            style="touch-action: pan-y;"
            tabindex={-1}
        >
            <div in:slide={{ duration: 0 }} data-vaul-no-drag class="h-full min-h-0">
                <Drawer.Close class="hidden">
                    <button bind:this={editCloseButton} type="button" aria-label="Fermer les paramètres"></button>
                </Drawer.Close>
                <FormSettingsMenu
                    type={$editCtx.type}
                    schema={$editCtx.schema}
                    props={editItem?.props ?? {}}
                    {formType}
                    previewContext={editPreviewProps}
                    update={(patch) => updateItem($editCtx.id, patch)}
                    close={requestCloseEdit}
                />
            </div>
        </Drawer.Content>
    </Drawer.Root>
{/if}
