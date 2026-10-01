<script lang="ts">
    import * as Icon from "lucide-svelte";
    import { Button } from "$lib/components/istyler";
    import { DEFAULT_FIELD_SIZES } from "./layout";
    import type { Item } from "./stores";
    import ToolbarItem from "./ToolbarItem.svelte";

    let {
        saving = false,
        onSave
    }: {
        saving?: boolean;
        onSave: () => void | Promise<boolean>;
    } = $props();
    let items: Item[] = [
        {
            name: "Groupe",
            type: "dynamicgroup",
            size: DEFAULT_FIELD_SIZES.dynamicgroup,
            icon: Icon.CopyPlus,
            props: {
                label: "Articles",
                description: "Ajoutez un ou plusieurs articles",
                itemLabel: "Article",
                addLabel: "Ajouter un article",
                minItems: 1,
                showCount: true,
                allowRemove: true,
            }
        },
        {
            name: "Texte",
            type: "text",
            size: DEFAULT_FIELD_SIZES.text,
            icon: Icon.TextCursorInput,
            props: {
                label: "Texte",
                placeholder: "Texte de substitution",
                icon: "Pyramid",
                iconSide: "left",
                helpText: "Texte d'aide (facultatif)",
                helpTextIcon: true
            }
        },
        {
            name: "Nombre",
            type: "number",
            size: DEFAULT_FIELD_SIZES.number,
            icon: Icon.Hash,
            props: {
                label: "Nombre",
                placeholder: "Texte de substitution",
                value: 10,
                min: 0,
                max: 100,
                step: 0.1,
                display: "lateral",
                iconSide: "right",
                helpText: "Indiquez une valeur entre 0 et 100",
                helpTextIcon: true
            }
        },
        {
            name: "Code",
            type: "password",
            size: DEFAULT_FIELD_SIZES.password,
            icon: Icon.RectangleEllipsis,
            props: {
                label: "Mot de passe",
                placeholder: "Texte de substitution",
                value: "Password1234",
                icon: "Vault",
                iconSide: "left",
                helpText: "Texte d'aide",
                helpTextIcon: true
            }
        },
        {
            name: "Liste",
            type: "select",
            size: DEFAULT_FIELD_SIZES.select,
            icon: Icon.ChevronsUpDown,
            props: {
                label: "Sélection",
                placeholder: "Choisissez une option",
                options: [
                    { value: "standard", label: "Standard", icon: "Box", helpText: "Option disponible par défaut" },
                    { value: "priority", label: "Prioritaire", icon: "Zap", helpText: "Affiche une option avec icône" },
                    { value: "archived", label: "Archivée", icon: "Archive", helpText: "Option désactivée", disabled: true }
                ],
                value: "standard",
                arrow: "ChevronDown",
                helpText: "Sélectionnez un élément dans la liste",
                helpTextIcon: true
            }
        },
        {
            name: "Radio",
            type: "radio",
            size: DEFAULT_FIELD_SIZES.radio,
            icon: Icon.CircleDot,
            props: {
                label: "Type d'intervention",
                options: [
                    { value: "repair", label: "Réparation", icon: "Wrench", helpText: "Intervention standard" },
                    { value: "diagnostic", label: "Diagnostic", icon: "Stethoscope", helpText: "Analyse sans réparation immédiate" },
                    { value: "warranty", label: "Garantie", icon: "ShieldCheck", helpText: "Option indisponible dans cet exemple", disabled: true }
                ],
                value: "repair",
                checkmark: "Circle",
                side: "right",
                box: true,
                direction: "vertical",
                helpText: "Choisissez une seule option",
                helpTextIcon: true
            }
        },
        {
            name: "Cochage",
            type: "checkbox",
            size: DEFAULT_FIELD_SIZES.checkbox,
            icon: Icon.CheckSquare,
            props: {
                label: "Contrôles effectués",
                options: [
                    { value: "visual", label: "Contrôle visuel", icon: "Eye", helpText: "Inspection externe rapide" },
                    { value: "battery", label: "Batterie testée", icon: "BatteryCharging", helpText: "Peut être décoché si non applicable" },
                    { value: "sealed", label: "Scellé constructeur", icon: "Lock", helpText: "Lecture seule", readonly: true }
                ],
                value: ["visual"],
                side: "right",
                box: true,
                direction: "vertical",
                helpText: "Plusieurs choix possibles",
                helpTextIcon: true
            }
        },
        {
            name: "Curseur",
            type: "range",
            size: DEFAULT_FIELD_SIZES.range,
            icon: Icon.SlidersHorizontal,
            props: {
                label: "Curseur",
                value: [20, 80],
                min: 0,
                max: 100,
                step: 1,
                range: true,
                suffix: "%",
                showValue: true,
                showBounds: true,
                helpText: "Déplacez le curseur",
                helpTextIcon: true
            }
        },
        {
            name: "Date",
            type: "date",
            size: DEFAULT_FIELD_SIZES.date,
            icon: Icon.Calendar,
            props: {
                label: "Date",
                mode: "date",
                value: new Date(),
                placeholder: "Aucune date sélectionnée",
                icon: "CalendarDays",
                calendarIcon: "Calendar",
                clearable: true,
                showCalendar: true,
                showFormattedValue: true,
                helpText: "Choisissez une date",
                helpTextIcon: true
            }
        },
        {
            name: "Bloc",
            type: "textarea",
            size: DEFAULT_FIELD_SIZES.textarea,
            icon: Icon.AlignLeft,
            props: {
                label: "Zone de texte",
                placeholder: "Votre texte...",
                helpText: "Texte d'aide",
                helpTextIcon: true
            }
        }
    ];

</script>

<aside
    class="flex h-full w-20 shrink-0 flex-col items-center justify-start gap-1 overflow-hidden
        border-l border-(--light-bg3) bg-(--light-bg1) p-2 text-(--dark-bg1)"
>
    {#each items as item}
        <ToolbarItem {item} />
    {/each}

    <Button
        variant="ghost"
        class="min-h-fit min-w-fit h-12! w-16! shrink-0 flex-col! gap-1 rounded-lg p-2! text-(--light-bg1) bg-(--dark-bg1)
            hover:bg-(--user-color)"
        disabled={saving}
        onclick={onSave}
    >
        <Icon.Save size={20}/>
        <span class="max-w-full truncate font-(family-name:--font) text-[11px] leading-none">
            {saving ? "Enregistrement..." : "Enregistrer"}
        </span>
    </Button>

</aside>
