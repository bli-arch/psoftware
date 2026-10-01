<!-- -------------------
 Need refactoring :
    - special states for text & badge displays
    - send data to database on save but show an alert to confirm before
    - some design (buttons, select, put save button somewhere else to induce "this button save all" instead of current "this button save this column")
-------------------- -->

<script lang="ts">
    import Sortable from 'sortablejs';
    import { Separator, Button as BTN, Dialog, Tabs, Tooltip } from "bits-ui";
    import MyDialog from "$lib/components/MyDialog.svelte";
    import * as Icon from "lucide-svelte";
    import { Button, Checkbox, Select, TextInput } from "$lib/components/istyler";
    import { onMount } from "svelte";
    import { animationTime } from "$lib/uiPreferences";
    import { apiGet, apiPatch, apiPut } from '$lib/api';
    import { toast } from 'svelte-sonner';
    import MyTooltip from '$lib/components/MyTooltip.svelte';
    import { tableCellDisplayOptions, type TableCellDisplay } from '$lib/components/table/tableDisplays';

    type TableSetting = {
        uuid: string,
        id: number;
        title: string;
        dataOrigin?: string;
        display?: TableCellDisplay;
        format?: string;
        setting?: Record<string, string|boolean|undefined>
    };

    interface FormLabelItem {
        title: string;
        value: string;
    }

    interface FormLabelSection {
        type: string;
        title: string;
        content: FormLabelItem[];
    }

    type Props = {
        open?: boolean;
    };

    let {
        open = $bindable()
    }: Props = $props();

    // State
    let sortableInstance: Sortable | null = null;
    let sortableContainer: HTMLElement | null = null;

    let currentTableSetting = $state<TableSetting | null>(null);
    let tableSettings = $state<TableSetting[]>([]);
    let formLabels = $state<FormLabelSection[]>([]);
    let formId: number | null = $state(null);
    let formSettings: Record<string, any> = $state({});

    // Derived state & const
    const currentTableUUID = $derived(currentTableSetting?.uuid);

    const updateCurrentTextSetting = (key: string, value: boolean) => {
        if (!currentTableSetting) return;
        currentTableSetting.setting ??= {};
        currentTableSetting.setting[key] = value;
    };

    const getPages = (formData: any) => formData?.form?.pages ?? formData?.pages ?? [];
    const getFields = (page: any) => page?.formFields ?? page?.items ?? [];
    const getFieldConfig = (field: any) => field?.config ?? field?.props ?? field ?? {};

    function buildOperationLabelSections(pages: any[] = []): FormLabelSection[] {
        return pages
            .filter((page) => page?.type !== "client")
            .map((page: any) => ({
                type: "data",
                title: page?.title ?? "Données",
                content: getFields(page)
                    .map((field: any) => {
                        const config = getFieldConfig(field);
                        const value = typeof config?.name === "string" ? config.name : "";

                        return {
                            title: config?.label ?? value,
                            value
                        };
                    })
                    .filter((item: FormLabelItem) => item.value)
            }))
            .filter((section) => section.content.length);
    }

    function buildClientLabelSection(clientForm: any): FormLabelSection | null {
        const fields = new Map<string, FormLabelItem>();

        getPages(clientForm).forEach((page: any) => {
            getFields(page).forEach((field: any) => {
                const config = getFieldConfig(field);
                const value = typeof config?.name === "string" ? config.name : "";
                if (!value || fields.has(value)) return;

                fields.set(value, {
                    title: config?.label ?? value,
                    value
                });
            });
        });

        const content = [...fields.values()];
        return content.length ? { type: "client", title: "Client", content } : null;
    }

    // Fetch initial data
    async function getTableSettings() {
        try {
           
            const [data, clientForm] = await Promise.all([
                apiGet(`/settings/form/active/operation`),
                apiGet(`/settings/form/active/client`).catch(() => null)
            ]);
            formId = data.id;
            formSettings = data.settings || {};
            tableSettings = (formSettings.tableSettings || []).map((setting: any) => ({
                ...setting,
                uuid: setting.uuid ?? crypto.randomUUID()
            }));
            currentTableSetting = tableSettings[0] || null;

            const clientSection = buildClientLabelSection(clientForm);
            formLabels = [
                ...(clientSection ? [clientSection] : []),
                ...buildOperationLabelSections(getPages(data))
            ];
            
            return data;
        } catch (error) {
            console.error("Failed to load table settings:", error);
            return { table_settings: [] };
        }
    }

    // Column management
    function addColumn() {
        const newColumn: TableSetting = {
            uuid: crypto.randomUUID(),
            dataOrigin: 'uid',
            display: 'text',
            id: tableSettings.length + 1,
            title: `Colonne ${tableSettings.length + 1}`,

        };
        tableSettings = [...tableSettings, newColumn];
        currentTableSetting = newColumn;
        
        // Refresh Sortable after DOM update
        setTimeout(() => {
            if (sortableInstance && sortableContainer) {
                sortableInstance.destroy();
                initSortable(sortableContainer);
            }
        });
    }

    function removeColumn(setting: TableSetting) {
        tableSettings = tableSettings.filter(item => item !== setting);
        currentTableSetting = tableSettings[tableSettings.length - 1] || null;
    }

    function refreshCurrent() {
        if (!currentTableSetting) return;
        const uuid = currentTableSetting.uuid;
        tableSettings = tableSettings.map((item) =>
            item.uuid === uuid ? { ...item, ...currentTableSetting } : item
        );
        // force reactive update for currentTableSetting
        currentTableSetting = { ...currentTableSetting };
    }

    async function saveColumn() {
        tableSettings = tableSettings.map((setting, index) => ({
            ...setting,
            id: index + 1,
        }));

        try {
            if (!formId) return;
            formSettings = { ...formSettings, tableSettings: $state.snapshot(tableSettings) };
            await apiPatch(`/settings/form/${formId}/`, { settings: formSettings });
            toast.success('Colonnes enregistrées');
            open = false
        } catch (error) {
            console.error('Error saving column:', error);
            toast.error('Erreur lors de la sauvegarde');
        }
    }

    function setTableSetting(setting: TableSetting) {
        currentTableSetting = tableSettings.find(item => item.uuid === setting.uuid) || null;
    }

    // Sortable initialization
    function initSortable(node: HTMLElement) {
        sortableContainer = node;
        sortableInstance = Sortable.create(node, {
            handle: ".grabber",
            swap: true,
            animation: animationTime(),
            ghostClass: "opacity-0",
            onEnd: (evt: any) => {
                const newIndex = evt.newIndex;
                const oldIndex = evt.oldIndex;
                
                if (newIndex === undefined || oldIndex === undefined) return;
                
                const newTableSettings = [...tableSettings];
                const [movedItem] = newTableSettings.splice(oldIndex, 1);
                newTableSettings.splice(newIndex, 0, movedItem);
                
                const updatedSettings = newTableSettings.map((setting, index) => ({
                    ...setting,
                    id: index + 1,
                }));
                
                tableSettings = updatedSettings;

                if (currentTableSetting) {
                    currentTableSetting = tableSettings.find(
                        s => s.uuid === currentTableSetting?.uuid
                    ) || null;
                }
                
            }
    });

    return {
        destroy() {
            sortableInstance?.destroy();
        }
    };
    }

    $effect(() => {
        if(currentTableSetting?.dataOrigin === "state")
            currentTableSetting.display = "state"
    });

    onMount(async () => {
        await getTableSettings()
    });

    $effect(() => {
        console.log($state.snapshot(currentTableSetting))
    })

</script>

<MyDialog 
    class="fixed left-1/2 top-1/2 box-border flex h-fit max-h-screen w-fit max-w-screen -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl bg-(--light-bg1) p-5 text-(--dark-bg1) shadow-(--shadow-popover)"
>
    <!-- Header -->
    <div class="flex flex-row justify-between items-start">
        <div class="flex flex-col">
            <span class="text-lg font-extrabold">Paramètres des colonnes</span>
            <span class="text-sm font-normal text-(--grey) flex-center gap-1">
                <Icon.Info size={12}/>
                Ajoutez les colonnes nécessaires à la lecture de la table
            </span>
        </div>
        <Dialog.Close>
            {#snippet child({ props })}
                <Button {...props} icon="X" class="px-2! bg-transparent! hover:bg-(--light-bg3)! text-(--dark-bg1)!"/>
            {/snippet}
        </Dialog.Close>
    </div>

    <!-- Main Content -->
    <div class="flex h-full w-full gap-4">
        <!-- Column List -->
        <div class="flex flex-col justify-between gap-2 w-64 max-w-64">
            <div class="flex flex-col gap-2 overflow-auto" use:initSortable bind:this={sortableContainer}>
                {#each tableSettings as setting (setting)}
                    <div class="flex gap-2">
                        <Button variant="ghost" onclick={() => setTableSetting(setting)}
                            class={`w-full h-8 outline-1 -outline-offset-1 outline-(--light-bg3) rounded-lg items-center 
                                    justify-between gap-1 px-1 select-none cursor-pointer focus:outline-1
                                   ${setting.uuid === currentTableUUID ? 'bg-(--user-color)/10 outline-(--user-color)' : 'bg-(--light-bg1)'}`}>
                                   
                            <div class="flex-center gap-1 max-w-53 w-full justify-start">
                                <Icon.GripVertical size="16" class="h-full grabber text-(--grey) min-w-4 cursor-grab active:cursor-grabbing"/>
                                <span class="truncate font-semibold text-sm text-nowrap overflow-hidden"> {setting.title} </span>
                            </div>

                            <Tooltip.Provider delayDuration={150}>
                                <Tooltip.Root>
                                    <Tooltip.Trigger>
                                        {#snippet child({ props })}
                                            <Button
                                                {...props}
                                                variant="ghost"
                                                icon="Trash2"
                                                class="w-8 px-2 text-(--grey) hover:text-(--red)"
                                                onclick={() => removeColumn(setting)}
                                            />
                                        {/snippet}
                                    </Tooltip.Trigger>
                                    <MyTooltip>
                                        Supprimer cette colonne
                                    </MyTooltip>
                                </Tooltip.Root>
                            </Tooltip.Provider>
                        </Button>
                    </div>
                {/each}
            </div>

            <Button label="+ Ajouter une colonne" onclick={addColumn}/>
        </div>

        <!-- Column Editor -->
        <div class="flex flex-col gap-2 justify-between w-84 h-118">

            {#if currentTableSetting}
                <!-- 
                    Editor fields structure:
                    - dataOrigin: uid / created_at / state.name / form_response.x (select)
                    - display: date / text / badge / state (conditional select)
                    - title: column title (text input) // text or set an icon instead
                    - id: column position (set by grabber)
                    
                    Special cases:
                    - date: format field
                    - text: styling options (bold, italic, color, ...)
                    - badge: configuration (icon, animation, color, font style)
                    - state: managed in state settings
                    - boolean : ?
                -->
                <div class="flex flex-col gap-3">
                    <!-- Data Origin Selector -->
                        <Select
                            name="dataOrigin"
                            label="Donnée"
                            bind:value={currentTableSetting.dataOrigin}
                            onchange={refreshCurrent}
                            allowDeselect={false}
                            options={[
                                {
                                    label: "Par défaut",
                                    options: [
                                        {
                                            label: "Identifiant",
                                            value: "uid"
                                        },
                                        {
                                            label: "Status",
                                            value: "state"
                                        },
                                        {
                                            label: "Créateur",
                                            value: "creator.username"
                                        },
                                        {
                                            label: "Date de création",
                                            value: "created_at"
                                        }
                                    ]
                                },
                                ...formLabels.map(section => ({
                                    label: section.title,
                                    options: section.content.map(item => ({
                                        label: item.title,
                                        value: `${section.type}.${item.value}`
                                    }))
                                }))
                            ]}
                        />                                

                    <!-- Display Type Selector -->
                    {#if currentTableSetting.dataOrigin !== "state"}
                        <Select
                            name="display"
                            label="Type d'affichage"
                            bind:value={currentTableSetting.display}
                            allowDeselect={false}
                            options={tableCellDisplayOptions}
                            
                            onchange={refreshCurrent}
                        />
                    {/if}


                    {#if currentTableSetting.display == 'date'}
                        <TextInput
                            name="format"
                            label="Format de la date"
                            bind:value={currentTableSetting.format}
                            oninput={refreshCurrent}
                        />
                    {:else if currentTableSetting.display == 'text'}

                        <div class="flex items-center gap-2">
                            <div class="w-fit">
                                <Checkbox box={true} icon="Italic" checkbox={false} 
                                on:change={(v) => updateCurrentTextSetting("italic", v.detail)}/>
                                <!-- need to initialize currentTableSetting correctly instead of the lazy "currentTableSetting = tableSettings[0] || null;"
                                choose a version  -->
                            </div>
                            <div class="w-fit">
                                <Checkbox box={true} icon="Bold" checkbox={false} 
                                on:change={(v) => updateCurrentTextSetting("bold", v.detail)}/>
                            </div>

                            <div class="w-fit">
                                <Checkbox box={true} icon="Underline" checkbox={false} 
                                on:change={(v) => updateCurrentTextSetting("underline", v.detail)}/>
                            </div>
                            <div class="w-fit">
                                <Checkbox box={true} icon="Strikethrough" checkbox={false} 
                                on:change={(v) => updateCurrentTextSetting("strikethrough", v.detail)}/>
                            </div>                        
                            
                        </div>
                        Noir - Gris - Rouge - Orange - Vert
                    {:else if currentTableSetting.display == 'badge'}
                        Color
                        Icon
                        Animation
                    {/if}



                    <!-- Column Title -->
                    <TextInput
                        name="title"
                        label="Titre de la colonne"
                        bind:value={currentTableSetting.title}
                        oninput={refreshCurrent}
                    />
                </div>
                <!-- Remove Button -->
                <Button label="Enregistrer" onclick={saveColumn}/>
            {/if}
        </div>
    </div>
</MyDialog>
