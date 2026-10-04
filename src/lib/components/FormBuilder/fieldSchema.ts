import {
    TextInput,
    NumberInput,
    Select,
    Checkbox,
    Radio,
    RangeValueInput,
    DateInput,
    DateFormatInput,
    Textarea,
    IconPicker,
    dateFieldFormatPresets,
    dateFieldFormatTokenCodes,
    validateDateFormat,
    type InputType,
    type InputComponent,
} from "../istyler";
import OptionListInput from "./OptionListInput.svelte";
import DisplayInput from "./DisplayInput.svelte";
import ReceiptDisplayInput from "./ReceiptDisplayInput.svelte";
import { CLIENT_IDENTITY_OPTIONS } from "$lib/clientIdentity";
import { hasPermission } from "$lib/auth";

export type FieldSchemaControl = {
    key: string;
    label: string;
    comp: InputComponent | typeof DateFormatInput | typeof OptionListInput | typeof RangeValueInput | typeof DisplayInput | typeof ReceiptDisplayInput;
    extra?: Record<string, any> | ((props: Record<string, any>) => Record<string, any>);
    defaultValue?: any | ((props: Record<string, any>) => any);
    visibleWhen?: (props: Record<string, any>) => boolean;
    validate?: (value: any, props: Record<string, any>) => string | null;
    span?: 1 | 2 | 3 | 4;
};

export type FieldSchemaGroup = {
    title: string;
    description?: string;
    hideHeader?: boolean;
    columns?: 1 | 2 | 3 | 4;
    items: FieldSchemaControl[];
    visibleWhen?: (props: Record<string, any>) => boolean;
};

export type FieldSchemaEntry = FieldSchemaControl | FieldSchemaGroup;
export type FieldSchemaItem = FieldSchemaControl;

export const displayOptionsByInputType: Partial<Record<InputType, string[]>> = {
    text: ["text", "longText", "identifier", "badge", "email", "phone"],
    number: ["number", "currency", "progress", "trend", "quality", "text", "identifier", "badge"],
    password: ["password", "text", "identifier", "badge"],
    select: ["text", "badge", "identifier", "tags"],
    checkbox: ["tags", "text", "badge", "identifier"],
    radio: ["text", "badge", "identifier"],
    range: ["number", "progress", "quality", "badge", "text"],
    date: ["date", "dueState", "timeSince", "text", "identifier", "badge"],
    textarea: ["longText"],
    dynamicgroup: ["group", "progress", "number", "tags", "text", "badge"],
};

export function dateDisplayOptions(mode: unknown) {
    if (mode === "time" || mode === "time-ms") return ["text", "identifier", "badge"];
    if (mode === "month" || mode === "year") return ["date", "text", "identifier", "badge"];
    return displayOptionsByInputType.date ?? ["date"];
}

export function defaultDateDisplayFormat(mode: unknown) {
    if (mode === "month") return "%B %Y";
    if (mode === "year") return "%Y";
    return "%d/%m/%Y";
}

function dynamicGroupSummary(value: unknown, checkable = false) {
    if (!Array.isArray(value)) return null;

    const total = value.length;
    const done = checkable ? value.filter((item: any) => item?.done === true).length : 0;
    return {
        total,
        done,
        text: checkable ? `${done}/${total}` : `${total}`,
    };
}

const receiptDisplaySection: FieldSchemaGroup = {
    title: "Reçu",
    description: "Affichage du champ sur le reçu officiel.",
    hideHeader: true,
    items: [
        {
            key: "receiptDisplay",
            label: "Reçu",
            comp: ReceiptDisplayInput,
            extra: (props) => ({
                fieldLabel: props.label,
                receiptLabel: props.receiptLabel,
                receiptFormat: props.receiptFormat,
                fieldType: props.fieldType,
                sampleValue: props.value,
            }),
        },
        {
            key: "receiptLabel",
            label: "Libellé sur le reçu",
            comp: TextInput,
            visibleWhen: (props) => Boolean(props.receiptDisplay),
            extra: (props) => ({
                placeholder: props.label ? String(props.label) : "Nom affiché sur le reçu",
                helpText: "Vide, le libellé du champ est utilisé.",
            }),
        },
        {
            key: "receiptFormat",
            label: "Format d’affichage",
            comp: DateFormatInput,
            visibleWhen: (props) =>
                props.fieldType === "date"
                && props.mode !== "time"
                && props.mode !== "time-ms"
                && Boolean(props.receiptDisplay),
            validate: (value, props) => validateDateFormat(String(value ?? ""), {
                required: true,
                allowedTokenCodes: dateFieldFormatTokenCodes(props.mode),
                allowLiteralPercent: true,
            }),
            extra: (props) => ({
                required: true,
                allowLiteralPercent: true,
                allowedTokenCodes: dateFieldFormatTokenCodes(props.mode),
                presets: dateFieldFormatPresets(props.mode),
                previewDate: props.value || new Date(2026, 5, 12),
                helpText: "Définit la présentation de la date dans le devis.",
                helpTextIcon: true,
            }),
        },
        {
            key: "receiptOrder",
            label: "Ordre d'affichage",
            comp: NumberInput,
            visibleWhen: (props) => Boolean(props.receiptDisplay),
            extra: {
                min: 0,
                step: 1,
                placeholder: "ex: 10",
                display: "lateral",
                helpText: "Les valeurs les plus faibles apparaissent en premier.",
            },
        },
    ],
    visibleWhen: (props) => props.formType === "operation" || props.formType === "client",
};

const clientIdentitySection: FieldSchemaGroup = {
    title: "Identité client",
    description: "Choisit la donnée utilisée pour identifier le client dans l’application et les reçus.",
    items: [
        {
            key: "clientIdentityRole",
            label: "Définir comme",
            comp: Radio,
            defaultValue: "",
            extra: {
                name: "client-identity-role",
                box: true,
                direction: "vertical",
                options: CLIENT_IDENTITY_OPTIONS,
            },
        },
    ],
    visibleWhen: (props) => props.formType === "client",
};

const trackingDisplaySection: FieldSchemaGroup = {
    title: "Suivi client",
    description: "Les champs publiés sont transmis au site externe et accessibles au client. Ne publiez aucune information confidentielle.",
    visibleWhen: (props) => (props.formType === "operation" || props.formType === "client") && hasPermission("tracking.manage"),
    items: [
        {
            key: "trackingDisplay",
            label: "Publier dans le suivi client",
            comp: Checkbox,
            defaultValue: false,
            extra: { switchMode: true, side: "left" },
        },
        {
            key: "trackingLabel",
            label: "Libellé public",
            comp: TextInput,
            visibleWhen: (props) => props.trackingDisplay === true,
            extra: (props) => ({ placeholder: props.label || "Libellé du champ", maxlength: 200 }),
        },
        {
            key: "trackingOrder",
            label: "Ordre d'affichage",
            comp: NumberInput,
            visibleWhen: (props) => props.trackingDisplay === true,
            extra: { min: 0, step: 1, display: "lateral" },
        },
    ],
};

export const fieldSchema: Partial<Record<InputType, FieldSchemaEntry[]>> = {
    text: [
        {
            title: "Contenu",
            description: "Libellé, indication, aide et valeur initiale.",
            items: [
                { key: "label", label: "Libellé", comp: TextInput, extra: { placeholder: "ex: Nom du produit" } },
                { key: "placeholder", label: "Texte indicatif", comp: TextInput, extra: { placeholder: "ex: Saisir un produit" } },
                { key: "value", label: "Valeur par défaut", comp: TextInput, extra: { placeholder: "ex: Article 1" } },
                { key: "helpText", label: "Texte d'aide", comp: TextInput, extra: { placeholder: "ex: Visible sous le champ" } },
            ],
        },
        {
            title: "Apparence",
            description: "Icône et texte affichés autour de la valeur.",
            columns: 2,
            items: [
                { key: "icon", label: "Icône", comp: IconPicker, span: 2, extra: { placeholder: "Rechercher une icône" } },
                {
                    key: "iconSide",
                    label: "Position",
                    comp: Radio,
                    defaultValue: "left",
                    span: 2,
                    extra: {
                        name: "text-icon-side",
                        box: true,
                        checkmark: false,
                        direction: "horizontal",
                        options: [
                            { label: "Gauche", value: "left", icon: "ChevronLeft", hideCheckbox: true },
                            { label: "Droite", value: "right", icon: "ChevronRight", hideCheckbox: true },
                        ],
                    },
                },
                { key: "prefix", label: "Préfixe", comp: TextInput, extra: { placeholder: "ex: https://" } },
                { key: "suffix", label: "Suffixe", comp: TextInput, extra: { placeholder: "ex: .com" } },
            ],
        },
        {
            title: "Comportement",
            columns: 2,
            items: [
                { key: "required", label: "Obligatoire", comp: Checkbox, extra: { box: false } },
                { key: "disabled", label: "Désactivé", comp: Checkbox, extra: { box: false } },
                { key: "readonly", label: "Lecture seule", comp: Checkbox, extra: { box: false } },
                { key: "helpTextIcon", label: "Icône d'aide", comp: Checkbox, extra: { box: false } },
            ],
        },
        {
            title: "Scan",
            description: "Saisie automatique par lecteur de codes-barres.",
            items: [
                { key: "scanSensitive", label: "Activer la saisie par scan", comp: Checkbox, extra: { switchMode: true, side: "left" } },
                {
                    key: "scanRegex",
                    label: "Format accepté",
                    comp: TextInput,
                    visibleWhen: (props) => Boolean(props.scanSensitive),
                    extra: {
                        placeholder: "ex: ^[0-9]{13}$",
                        helpText: "Expression régulière. Vide, tous les codes sont acceptés.",
                        helpTextIcon: true,
                    },
                },
            ],
        },
        {
            title: "Affichage",
            description: "Format d'affichage dans les tableaux et fiches.",
            hideHeader: true,
            items: [
                {
                    key: "displayValue",
                    label: "Affichage",
                    comp: DisplayInput,
                    defaultValue: "text",
                    extra: (props) => ({
                        description: "Format d'affichage dans les tableaux et fiches.",
                        options: displayOptionsByInputType.text,
                        sampleValue: props.value,
                    }),
                },
            ],
        },
    ],
    number: [
        {
            title: "Contenu",
            description: "Libellé, indication, aide et valeur initiale.",
            items: [
                { key: "label", label: "Libellé", comp: TextInput, extra: { placeholder: "ex: Prix de vente" } },
                { key: "placeholder", label: "Texte indicatif", comp: TextInput, extra: { placeholder: "ex: 0,00" } },
                { key: "value", label: "Valeur par défaut", comp: NumberInput, extra: { placeholder: "ex: 25" } },
                { key: "helpText", label: "Texte d'aide", comp: TextInput, extra: { placeholder: "ex: Montant hors taxes" } },
            ],
        },
        {
            title: "Contraintes",
            description: "Valeurs minimale, maximale et pas d'incrémentation.",
            columns: 3,
            items: [
                { key: "min", label: "Minimum", comp: NumberInput, extra: { placeholder: "ex: 0", display: "lateral" } },
                { key: "max", label: "Maximum", comp: NumberInput, extra: { placeholder: "ex: 999", display: "lateral" } },
                { key: "step", label: "Pas", comp: NumberInput, defaultValue: 1, extra: { placeholder: "ex: 0,01" } },
            ],
        },
        {
            title: "Apparence",
            description: "Préfixe, suffixe et disposition des boutons.",
            columns: 2,
            items: [
                { key: "prefix", label: "Préfixe", comp: TextInput, extra: { placeholder: "ex: €" } },
                { key: "suffix", label: "Suffixe", comp: TextInput, extra: { placeholder: "ex: %" } },
                {
                    key: "display",
                    label: "Disposition",
                    comp: Radio,
                    defaultValue: "stacked",
                    span: 2,
                    extra: {
                        name: "number-display",
                        box: true,
                        checkmark: false,
                        direction: "horizontal",
                        options: [
                            { label: "Empilée", value: "stacked", icon: "PanelTop", hideCheckbox: true },
                            { label: "Latérale", value: "lateral", icon: "PanelLeft", hideCheckbox: true },
                        ],
                    },
                },
                {
                    key: "iconSide",
                    label: "Boutons",
                    comp: Radio,
                    defaultValue: "right",
                    span: 2,
                    visibleWhen: (props) => props.display !== "lateral",
                    extra: {
                        name: "number-icon-side",
                        box: true,
                        checkmark: false,
                        direction: "horizontal",
                        options: [
                            { label: "À gauche", value: "left", icon: "ChevronLeft", hideCheckbox: true },
                            { label: "À droite", value: "right", icon: "ChevronRight", hideCheckbox: true },
                        ],
                    },
                },
            ],
        },
        {
            title: "Comportement",
            columns: 2,
            items: [
                { key: "required", label: "Obligatoire", comp: Checkbox, extra: { box: false } },
                { key: "disabled", label: "Désactivé", comp: Checkbox, extra: { box: false } },
                { key: "readonly", label: "Lecture seule", comp: Checkbox, extra: { box: false } },
                { key: "helpTextIcon", label: "Icône d'aide", comp: Checkbox, extra: { box: false } },
            ],
        },
        {
            title: "Affichage",
            description: "Format d'affichage dans les tableaux et fiches.",
            hideHeader: true,
            items: [
                {
                    key: "displayValue",
                    label: "Affichage",
                    comp: DisplayInput,
                    defaultValue: "number",
                    extra: (props) => ({
                        description: "Format d'affichage dans les tableaux et fiches.",
                        options: displayOptionsByInputType.number,
                        sampleValue: props.value,
                    }),
                },
            ],
        },
    ],
    password: [
        {
            title: "Contenu",
            description: "Libellé, indication, aide et valeur initiale.",
            items: [
                { key: "label", label: "Libellé", comp: TextInput, extra: { placeholder: "ex: Mot de passe" } },
                { key: "placeholder", label: "Texte indicatif", comp: TextInput, extra: { placeholder: "ex: Saisir le mot de passe" } },
                { key: "value", label: "Valeur par défaut", comp: TextInput, extra: { placeholder: "ex: temporaire-123" } },
                { key: "helpText", label: "Texte d'aide", comp: TextInput, extra: { placeholder: "ex: Minimum 12 caractères" } },
            ],
        },
        {
            title: "Apparence",
            description: "Icône et texte affichés autour de la valeur.",
            columns: 2,
            items: [
                { key: "icon", label: "Icône", comp: IconPicker, span: 2, extra: { placeholder: "Rechercher une icône" } },
                {
                    key: "iconSide",
                    label: "Position",
                    comp: Radio,
                    defaultValue: "right",
                    span: 2,
                    extra: {
                        name: "password-icon-side",
                        box: true,
                        checkmark: false,
                        direction: "horizontal",
                        options: [
                            { label: "Gauche", value: "left", icon: "ChevronLeft", hideCheckbox: true },
                            { label: "Droite", value: "right", icon: "ChevronRight", hideCheckbox: true },
                            { label: "Les deux", value: "both", icon: "PanelLeftRight", hideCheckbox: true },
                        ],
                    },
                },
                { key: "prefix", label: "Préfixe", comp: TextInput, extra: { placeholder: "ex: #" } },
                { key: "suffix", label: "Suffixe", comp: TextInput, extra: { placeholder: "ex: requis" } },
            ],
        },
        {
            title: "Visibilité du mot de passe",
            description: "Affichage temporaire de la valeur saisie.",
            columns: 2,
            items: [
                { key: "showPassword", label: "Afficher le bouton de visibilité", comp: Checkbox, defaultValue: true, span: 2, extra: { switchMode: true, side: "left" } },
                {
                    key: "showPasswordIcon",
                    label: "Icône si visible",
                    comp: IconPicker,
                    defaultValue: "Eye",
                    visibleWhen: (props) => props.showPassword !== false,
                    extra: { placeholder: "Rechercher une icône" },
                },
                {
                    key: "hidePasswordIcon",
                    label: "Icône si masqué",
                    comp: IconPicker,
                    defaultValue: "EyeOff",
                    visibleWhen: (props) => props.showPassword !== false,
                    extra: { placeholder: "Rechercher une icône" },
                },
            ],
        },
        {
            title: "Comportement",
            columns: 2,
            items: [
                { key: "required", label: "Obligatoire", comp: Checkbox, extra: { box: false } },
                { key: "disabled", label: "Désactivé", comp: Checkbox, extra: { box: false } },
                { key: "readonly", label: "Lecture seule", comp: Checkbox, extra: { box: false } },
                { key: "helpTextIcon", label: "Icône d'aide", comp: Checkbox, extra: { box: false } },
            ],
        },
        {
            title: "Affichage",
            description: "Format d'affichage dans les tableaux et fiches.",
            hideHeader: true,
            items: [
                {
                    key: "displayValue",
                    label: "Affichage",
                    comp: DisplayInput,
                    defaultValue: "password",
                    extra: (props) => ({
                        description: "Format d'affichage dans les tableaux et fiches.",
                        options: displayOptionsByInputType.password,
                        sampleValue: props.value,
                    }),
                },
            ],
        },
    ],
    select: [
        {
            title: "Contenu",
            description: "Libellé, indication, aide et sélection initiale.",
            items: [
                { key: "label", label: "Libellé", comp: TextInput, extra: { placeholder: "ex: Statut" } },
                { key: "placeholder", label: "Texte indicatif", comp: TextInput, extra: { placeholder: "ex: Choisir un statut" } },
                {
                    key: "value",
                    label: "Valeur par défaut",
                    comp: Select,
                    extra: (props) => ({
                        allowDeselect: true,
                        multiple: props.multiple ? true : false,
                        placeholder: "Aucune valeur par défaut",
                        options: Array.isArray(props.options) ? props.options : [],
                    }),
                },
                { key: "helpText", label: "Texte d'aide", comp: TextInput, extra: { placeholder: "ex: Sélectionner une option dans la liste" } },
            ],
        },
        {
            title: "Options",
            description: "Choix proposés à l'utilisateur.",
            items: [
                { key: "options", label: "Options", comp: OptionListInput, extra: { showReadonly: true, showHideCheckbox: false } },
            ],
        },
        {
            title: "Sélection",
            description: "Choix unique ou multiple et désélection.",
            columns: 2,
            items: [
                { key: "multiple", label: "Sélection multiple", comp: Checkbox, extra: { switchMode: true, side: "left" } },
                { key: "allowDeselect", label: "Autoriser la désélection", comp: Checkbox, defaultValue: true, extra: { switchMode: true, side: "left" } },
            ],
        },
        {
            title: "Apparence",
            description: "Icône d'ouverture de la liste.",
            items: [
                { key: "arrow", label: "Icône d'ouverture", comp: IconPicker, defaultValue: "ChevronDown", extra: { placeholder: "Rechercher une icône" } },
            ],
        },
        {
            title: "Comportement",
            columns: 2,
            items: [
                { key: "required", label: "Obligatoire", comp: Checkbox, extra: { box: false } },
                { key: "disabled", label: "Désactivé", comp: Checkbox, extra: { box: false } },
                { key: "helpTextIcon", label: "Icône d'aide", comp: Checkbox, extra: { box: false } },
            ],
        },
        {
            title: "Affichage",
            description: "Format d'affichage dans les tableaux et fiches.",
            hideHeader: true,
            items: [
                {
                    key: "displayValue",
                    label: "Affichage",
                    comp: DisplayInput,
                    defaultValue: "text",
                    extra: (props) => ({
                        description: "Format d'affichage dans les tableaux et fiches.",
                        options: displayOptionsByInputType.select,
                        sampleValue: props.value,
                    }),
                },
            ],
        },
    ],
    checkbox: [
        {
            title: "Contenu",
            description: "Libellé, aide et sélections initiales.",
            items: [
                { key: "label", label: "Libellé", comp: TextInput, extra: { placeholder: "ex: Contrôles effectués" } },
                {
                    key: "value",
                    label: "Valeur par défaut",
                    comp: Select,
                    extra: (props) => ({
                        allowDeselect: true,
                        multiple: true,
                        placeholder: "Aucune valeur par défaut",
                        options: Array.isArray(props.options) ? props.options : [],
                    }),
                },
                { key: "helpText", label: "Texte d'aide", comp: TextInput, extra: { placeholder: "ex: Plusieurs choix possibles" } },
            ],
        },
        {
            title: "Options",
            description: "Choix proposés à l'utilisateur.",
            items: [
                {
                    key: "options",
                    label: "Options",
                    comp: OptionListInput,
                    extra: { showReadonly: true, showHideCheckbox: true, showSwitchMode: true, minOptions: 1 },
                },
            ],
        },
        {
            title: "Sélection",
            description: "Disposition des options et position des libellés.",
            columns: 2,
            items: [
                {
                    key: "direction",
                    label: "Disposition",
                    comp: Radio,
                    defaultValue: "vertical",
                    span: 2,
                    extra: {
                        name: "checkbox-direction",
                        box: true,
                        checkmark: false,
                        direction: "horizontal",
                        options: [
                            { label: "Horizontale", value: "horizontal", icon: "Columns2", hideCheckbox: true },
                            { label: "Verticale", value: "vertical", icon: "Rows2", hideCheckbox: true },
                        ],
                    },
                },
                {
                    key: "side",
                    label: "Position du libellé",
                    comp: Radio,
                    defaultValue: "right",
                    span: 2,
                    extra: {
                        name: "checkbox-side",
                        box: true,
                        checkmark: false,
                        direction: "horizontal",
                        options: [
                            { label: "À gauche", value: "left", icon: "ChevronLeft", hideCheckbox: true },
                            { label: "À droite", value: "right", icon: "ChevronRight", hideCheckbox: true },
                        ],
                    },
                },
            ],
        },
        {
            title: "Style",
            description: "Apparence des options.",
            items: [
                {
                    key: "checkmark",
                    label: "Icône de coche",
                    comp: IconPicker,
                    defaultValue: "Check",
                    extra: { placeholder: "Rechercher une icône" },
                },
                { key: "box", label: "Présentation en cartes", comp: Checkbox, extra: { switchMode: true, side: "left" } },
            ],
        },
        {
            title: "Comportement",
            columns: 2,
            items: [
                { key: "required", label: "Obligatoire", comp: Checkbox, extra: { box: false } },
                { key: "disabled", label: "Désactivé", comp: Checkbox, extra: { box: false } },
                { key: "readonly", label: "Lecture seule", comp: Checkbox, extra: { box: false } },
                { key: "helpTextIcon", label: "Icône d'aide", comp: Checkbox, extra: { box: false } },
            ],
        },
        {
            title: "Affichage",
            description: "Format d'affichage dans les tableaux et fiches.",
            hideHeader: true,
            items: [
                {
                    key: "displayValue",
                    label: "Affichage",
                    comp: DisplayInput,
                    defaultValue: "tags",
                    extra: (props) => ({
                        description: "Format d'affichage dans les tableaux et fiches.",
                        options: displayOptionsByInputType.checkbox,
                        sampleValue: props.value,
                    }),
                },
            ],
        },
    ],
    radio: [
        {
            title: "Contenu",
            description: "Libellé, aide et sélection initiale.",
            items: [
                { key: "label", label: "Libellé", comp: TextInput, extra: { placeholder: "ex: Priorité" } },
                {
                    key: "value",
                    label: "Valeur par défaut",
                    comp: Select,
                    extra: (props) => ({
                        allowDeselect: true,
                        placeholder: "Aucune valeur par défaut",
                        options: Array.isArray(props.options) ? props.options : [],
                    }),
                },
                { key: "helpText", label: "Texte d'aide", comp: TextInput, extra: { placeholder: "ex: Choisir une seule option" } },
            ],
        },
        {
            title: "Options",
            description: "Choix proposés à l'utilisateur.",
            items: [
                { key: "options", label: "Options", comp: OptionListInput, extra: { showReadonly: true, showHideCheckbox: true } },
            ],
        },
        {
            title: "Sélection",
            description: "Disposition des options et position des libellés.",
            columns: 2,
            items: [
                {
                    key: "direction",
                    label: "Disposition",
                    comp: Radio,
                    defaultValue: "horizontal",
                    span: 2,
                    extra: {
                        name: "radio-direction",
                        box: true,
                        checkmark: false,
                        direction: "horizontal",
                        options: [
                            { label: "Horizontale", value: "horizontal", icon: "Columns2", hideCheckbox: true },
                            { label: "Verticale", value: "vertical", icon: "Rows2", hideCheckbox: true },
                        ],
                    },
                },
                {
                    key: "side",
                    label: "Position du libellé",
                    comp: Radio,
                    defaultValue: "right",
                    span: 2,
                    extra: {
                        name: "radio-side",
                        box: true,
                        checkmark: false,
                        direction: "horizontal",
                        options: [
                            { label: "À gauche", value: "left", icon: "ChevronLeft", hideCheckbox: true },
                            { label: "À droite", value: "right", icon: "ChevronRight", hideCheckbox: true },
                        ],
                    },
                },
            ],
        },
        {
            title: "Style",
            description: "Apparence des options.",
            items: [
                { key: "checkmark", label: "Icône de sélection", comp: IconPicker, defaultValue: "Circle", span: 2, extra: { placeholder: "Rechercher une icône" } },
                { key: "box", label: "Présentation en cartes", comp: Checkbox, extra: { switchMode: true, side: "left" } },
            ],
        },
        {
            title: "Comportement",
            columns: 2,
            items: [
                { key: "required", label: "Obligatoire", comp: Checkbox, extra: { box: false } },
                { key: "disabled", label: "Désactivé", comp: Checkbox, extra: { box: false } },
                { key: "readonly", label: "Lecture seule", comp: Checkbox, extra: { box: false } },
                { key: "helpTextIcon", label: "Icône d'aide", comp: Checkbox, extra: { box: false } },
            ],
        },
        {
            title: "Affichage",
            description: "Format d'affichage dans les tableaux et fiches.",
            hideHeader: true,
            items: [
                {
                    key: "displayValue",
                    label: "Affichage",
                    comp: DisplayInput,
                    defaultValue: "text",
                    extra: (props) => ({
                        description: "Format d'affichage dans les tableaux et fiches.",
                        options: displayOptionsByInputType.radio,
                        sampleValue: props.value,
                    }),
                },
            ],
        },
    ],
    range: [
        {
            title: "Contenu",
            description: "Libellé et aide du champ.",
            items: [
                { key: "label", label: "Libellé", comp: TextInput, extra: { placeholder: "ex: Niveau de priorité" } },
                { key: "helpText", label: "Texte d'aide", comp: TextInput, extra: { placeholder: "ex: Déplacer le curseur pour ajuster la valeur" } },
            ],
        },
        {
            title: "Configuration",
            description: "Mode de sélection, bornes et précision.",
            columns: 3,
            items: [
                { key: "range", label: "Plage de valeurs", comp: Checkbox, span: 3, extra: { switchMode: true, side: "left" } },
                { key: "min", label: "Minimum", comp: NumberInput, defaultValue: 0, extra: { display: "lateral" } },
                { key: "max", label: "Maximum", comp: NumberInput, defaultValue: 100, extra: { display: "lateral" } },
                { key: "step", label: "Pas", comp: NumberInput, defaultValue: 1, extra: { placeholder: "ex: 1", step: 1 }},
            ],
        },
        {
            title: "Valeur initiale",
            description: "Valeur proposée par défaut.",
            items: [
                {
                    key: "value",
                    label: "Valeur par défaut",
                    comp: RangeValueInput,
                    extra: (props) => ({
                        range: Boolean(props.range),
                        min: Number(props.min ?? 0),
                        max: Number(props.max ?? 100),
                        step: Number(props.step ?? 1),
                    }),
                },
            ],
        },
        {
            title: "Apparence",
            description: "Valeur, bornes et affixes affichés.",
            columns: 2,
            items: [
                { key: "showValue", label: "Afficher la valeur", comp: Checkbox, defaultValue: true, extra: { switchMode: true, side: "left" } },
                { key: "showBounds", label: "Afficher les bornes", comp: Checkbox, defaultValue: true, extra: { switchMode: true, side: "left" } },
                {
                    key: "prefix",
                    label: "Préfixe",
                    comp: TextInput,
                    extra: (props) => ({ placeholder: "ex: €", readonly: props.showBounds === false }),
                },
                {
                    key: "suffix",
                    label: "Suffixe",
                    comp: TextInput,
                    extra: (props) => ({ placeholder: "ex: %", readonly: props.showBounds === false }),
                },
            ],
        },
        {
            title: "Comportement",
            columns: 2,
            items: [
                { key: "required", label: "Obligatoire", comp: Checkbox, extra: { box: false } },
                { key: "disabled", label: "Désactivé", comp: Checkbox, extra: { box: false } },
                { key: "readonly", label: "Lecture seule", comp: Checkbox, extra: { box: false } },
                { key: "helpTextIcon", label: "Icône d'aide", comp: Checkbox, extra: { box: false } },
            ],
        },
        {
            title: "Affichage",
            description: "Format d'affichage dans les tableaux et fiches.",
            hideHeader: true,
            items: [
                {
                    key: "displayValue",
                    label: "Affichage",
                    comp: DisplayInput,
                    defaultValue: "number",
                    extra: (props) => ({
                        description: "Format d'affichage dans les tableaux et fiches.",
                        options: displayOptionsByInputType.range,
                        sampleValue: props.value,
                    }),
                },
            ],
        },
    ],
    date: [
        {
            title: "Format",
            description: "Type de valeur à saisir.",
            items: [
                {
                    key: "mode",
                    label: "Format",
                    comp: Select,
                    defaultValue: "date",
                    extra: {
                        name: "date-mode",
                        allowDeselect: false,
                        options: [
                            { label: "Date", value: "date", icon: "CalendarDays", helpText: "Jour, mois et année" },
                            { label: "Mois et année", value: "month", icon: "CalendarRange", helpText: "Sans jour précis" },
                            { label: "Année", value: "year", icon: "Calendar", helpText: "Année uniquement" },
                            { label: "Heure", value: "time", icon: "Clock3", helpText: "Heures et minutes" },
                            { label: "Minutes et secondes", value: "time-ms", icon: "Timer", helpText: "Durée inférieure à une heure" },
                        ],
                    },
                },
            ],
        },
        {
            title: "Contenu",
            description: "Libellé, valeur initiale et aide.",
            items: [
                { key: "label", label: "Libellé", comp: TextInput, extra: { placeholder: "ex: Date de livraison" } },
                {
                    key: "value",
                    label: "Valeur initiale",
                    comp: DateInput,
                    extra: (props) => ({
                        mode: props.mode ?? "date",
                        showSeconds: props.showSeconds === true,
                        min: props.min,
                        max: props.max,
                        icon: "",
                        showFormattedValue: false,
                    }),
                },
                { key: "helpText", label: "Texte d'aide", comp: TextInput, extra: { placeholder: "ex: Date souhaitée par le client" } },
            ],
        },
        {
            title: "Contraintes",
            description: "Limites de saisie autorisées.",
            items: [
                {
                    key: "min",
                    label: "Valeur minimale",
                    comp: DateInput,
                    extra: (props) => ({
                        mode: props.mode ?? "date",
                        showSeconds: props.showSeconds === true,
                        max: props.max,
                        icon: "",
                        showFormattedValue: false,
                    }),
                },
                {
                    key: "max",
                    label: "Valeur maximale",
                    comp: DateInput,
                    extra: (props) => ({
                        mode: props.mode ?? "date",
                        showSeconds: props.showSeconds === true,
                        min: props.min,
                        icon: "",
                        showFormattedValue: false,
                    }),
                },
            ],
        },
        {
            title: "Apparence",
            description: "Icônes, actions et précision affichées.",
            items: [
                {
                    key: "icon",
                    label: "Icône du champ",
                    comp: IconPicker,
                    defaultValue: (props: Record<string, any>) => props.mode === "time-ms" ? "Timer" : props.mode === "time" ? "Clock3" : "CalendarDays",
                    extra: { placeholder: "Rechercher une icône" },
                },
                {
                    key: "showSeconds",
                    label: "Afficher les secondes",
                    comp: Checkbox,
                    defaultValue: false,
                    visibleWhen: (props) => props.mode === "time",
                    extra: { switchMode: true, side: "left" },
                },
                {
                    key: "showCalendar",
                    label: "Afficher le calendrier",
                    comp: Checkbox,
                    defaultValue: true,
                    visibleWhen: (props) => props.mode !== "time" && props.mode !== "time-ms",
                    extra: { switchMode: true, side: "left" },
                },
                {
                    key: "calendarIcon",
                    label: "Icône du sélecteur",
                    comp: IconPicker,
                    defaultValue: "Calendar",
                    visibleWhen: (props) => props.showCalendar !== false || props.mode === "time" || props.mode === "time-ms",
                    extra: {
                        placeholder: "Rechercher une icône",
                        allowDeselect: false,
                        fallback: "Calendar",
                    },
                },
                { key: "clearable", label: "Afficher le bouton d'effacement", comp: Checkbox, defaultValue: true, extra: { switchMode: true, side: "left" } },
                {
                    key: "showFormattedValue",
                    label: "Afficher la date en toutes lettres",
                    comp: Checkbox,
                    defaultValue: true,
                    visibleWhen: (props) => props.mode === "date" || props.mode === "month",
                    extra: { switchMode: true, side: "left" },
                },
                {
                    key: "placeholder",
                    label: "Texte lorsque le champ est vide",
                    comp: TextInput,
                    visibleWhen: (props) => props.showFormattedValue !== false && (props.mode === "date" || props.mode === "month"),
                    extra: { placeholder: "ex: Aucune date sélectionnée" },
                },
            ],
        },
        {
            title: "Comportement",
            columns: 2,
            items: [
                { key: "required", label: "Obligatoire", comp: Checkbox, extra: { box: false } },
                { key: "disabled", label: "Désactivé", comp: Checkbox, extra: { box: false } },
                { key: "readonly", label: "Lecture seule", comp: Checkbox, extra: { box: false } },
                { key: "helpTextIcon", label: "Icône d'aide", comp: Checkbox, extra: { box: false } },
            ],
        },
        {
            title: "Affichage",
            description: "Format d'affichage dans les tableaux et fiches.",
            hideHeader: true,
            items: [
                {
                    key: "displayValue",
                    label: "Affichage",
                    comp: DisplayInput,
                    defaultValue: (props: Record<string, any>) => props.mode === "time" || props.mode === "time-ms" ? "text" : "date",
                    extra: (props) => ({
                        description: "Format d'affichage dans les tableaux et fiches.",
                        options: dateDisplayOptions(props.mode),
                        sampleValue: props.value,
                        setting: props,
                    }),
                },
                {
                    key: "format",
                    label: "Format d’affichage",
                    comp: DateFormatInput,
                    defaultValue: (props: Record<string, any>) => defaultDateDisplayFormat(props.mode),
                    visibleWhen: (props) => props.displayValue === "date",
                    validate: (value, props) => validateDateFormat(String(value ?? ""), {
                        required: true,
                        allowedTokenCodes: dateFieldFormatTokenCodes(props.mode),
                        allowLiteralPercent: true,
                    }),
                    extra: (props) => ({
                        required: true,
                        allowLiteralPercent: true,
                        allowedTokenCodes: dateFieldFormatTokenCodes(props.mode),
                        presets: dateFieldFormatPresets(props.mode),
                        previewDate: props.value || new Date(2026, 5, 12),
                        helpText: "Détermine la présentation de la date dans les tableaux et les fiches.",
                        helpTextIcon: true,
                    }),
                },
            ],
        },
    ],
    textarea: [
        {
            title: "Contenu",
            description: "Libellé, indication, aide et valeur initiale.",
            items: [
                { key: "label", label: "Libellé", comp: TextInput, extra: { placeholder: "ex: Commentaire" } },
                { key: "placeholder", label: "Texte indicatif", comp: TextInput, extra: { placeholder: "ex: Ajouter une note" } },
                { key: "value", label: "Valeur par défaut", comp: Textarea, extra: { placeholder: "ex: Informations à compléter" } },
                { key: "helpText", label: "Texte d'aide", comp: TextInput, extra: { placeholder: "ex: Visible sous le champ" } },
            ],
        },
        {
            title: "Comportement",
            columns: 2,
            items: [
                { key: "required", label: "Obligatoire", comp: Checkbox, extra: { box: false } },
                { key: "disabled", label: "Désactivé", comp: Checkbox, extra: { box: false } },
                { key: "readonly", label: "Lecture seule", comp: Checkbox, extra: { box: false } },
                { key: "helpTextIcon", label: "Icône d'aide", comp: Checkbox, extra: { box: false } },
            ],
        },
        {
            title: "Affichage",
            description: "Format d'affichage dans les tableaux et fiches.",
            hideHeader: true,
            items: [
                {
                    key: "displayValue",
                    label: "Affichage",
                    comp: DisplayInput,
                    defaultValue: "longText",
                    extra: (props) => ({
                        description: "Format d'affichage dans les tableaux et fiches.",
                        options: displayOptionsByInputType.textarea,
                        sampleValue: props.value,
                    }),
                },
            ],
        },
    ],
    dynamicgroup: [
        {
            title: "Contenu",
            description: "Titre, description et libellés du groupe.",
            items: [
                { key: "label", label: "Titre du groupe", comp: TextInput, defaultValue: "Groupe", extra: { placeholder: "ex: Articles" } },
                { key: "description", label: "Description", comp: TextInput, extra: { placeholder: "ex: Ajoutez un ou plusieurs articles" } },
                {
                    key: "itemLabel",
                    label: "Libellé d'un élément",
                    comp: TextInput,
                    defaultValue: "Élément",
                    extra: {
                        placeholder: "ex: Article",
                        helpText: "Nom affiché pour chaque ligne du groupe.",
                        helpTextIcon: true,
                    },
                },
                { key: "addLabel", label: "Bouton d'ajout", comp: TextInput, defaultValue: "Ajouter un élément", extra: { placeholder: "ex: Ajouter un article" } },
            ],
        },
        {
            title: "Éléments",
            description: "Limites et actions disponibles.",
            columns: 2,
            items: [
                { key: "minItems", label: "Minimum", comp: NumberInput, defaultValue: 1, extra: { min: 0, step: 1, display: "lateral" } },
                {
                    key: "maxItems",
                    label: "Maximum",
                    comp: NumberInput,
                    extra: (props) => ({
                        min: Math.max(1, Number(props.minItems ?? 1)),
                        step: 1,
                        display: "lateral",
                        placeholder: "Aucune limite",
                    }),
                },
                { key: "showCount", label: "Afficher le compteur", comp: Checkbox, defaultValue: true, extra: { switchMode: true, side: "left" } },
                { key: "allowRemove", label: "Autoriser la suppression", comp: Checkbox, defaultValue: true, extra: { switchMode: true, side: "left" } },
                { key: "checkable", label: "Éléments cochables", comp: Checkbox, span: 2, extra: { switchMode: true, side: "left" } },
            ],
        },
        {
            title: "Affichage",
            description: "Format d'affichage dans les tableaux et fiches.",
            hideHeader: true,
            items: [
                {
                    key: "displayValue",
                    label: "Affichage",
                    comp: DisplayInput,
                    defaultValue: "group",
                    extra: (props) => ({
                        description: "Format d'affichage dans les tableaux et fiches.",
                        options: displayOptionsByInputType.dynamicgroup,
                        sampleValue: props.value,
                        setting: props,
                        dynamicGroup: dynamicGroupSummary(props.value, Boolean(props.checkable)),
                    }),
                },
            ],
        },
    ],
};

for (const inputType of Object.keys(fieldSchema) as InputType[]) {
    if (inputType === "text") fieldSchema[inputType]?.push(clientIdentitySection);
    fieldSchema[inputType]?.push(receiptDisplaySection);
    if (["text", "number", "select", "checkbox", "radio", "range", "date", "textarea"].includes(inputType)) fieldSchema[inputType]?.push(trackingDisplaySection);
}
