import { createRender } from "svelte-headless-table";
import DisplayValue, {
    type DisplayValueKind,
    type DynamicGroupSummary
} from "./DisplayValue.svelte";

export type { DynamicGroupSummary };

export type TableDisplayContext = {
    value: unknown;
    setting: Record<string, any>;
    states?: Array<Record<string, any>>;
    dynamicGroup?: DynamicGroupSummary | null;
};

export type TableDisplayConfig = {
    label: string;
    icon: string;
    helpText: string;
    sampleValue: unknown;
};

export const TABLE_CELL_DISPLAYS = {
    text: {
        label: "Texte",
        icon: "AlignLeft",
        helpText: "Valeur simple, compacte et lisible.",
        sampleValue: "Texte court",
    },
    longText: {
        label: "Texte long",
        icon: "Rows3",
        helpText: "Résumé tronqué pour les contenus plus longs.",
        sampleValue: "Texte détaillée avec plusieurs informations utiles.",
    },
    identifier: {
        label: "Identifiant",
        icon: "Hash",
        helpText: "Code technique, référence ou numéro court.",
        sampleValue: "OP-2048-A"
    },
    password: {
        label: "Mot de passe",
        icon: "KeyRound",
        helpText: "Valeur masquée, visible pendant l'appui.",
        sampleValue: "temporaire-123"
    },
    date: {
        label: "Date",
        icon: "CalendarDays",
        helpText: "Date lisible avec repère visuel.",
        sampleValue: "2026-06-04"
    },
    dueState: {
        label: "Échéance",
        icon: "CalendarClock",
        helpText: "Statut relatif à une date limite.",
        sampleValue: "2026-06-04"
    },
    timeSince: {
        label: "Depuis",
        icon: "Clock3",
        helpText: "Temps écoulé ou restant par rapport à une date.",
        sampleValue: "2026-06-04"
    },
    number: {
        label: "Nombre",
        icon: "Sigma",
        helpText: "Nombre aligné et facile à comparer.",
        sampleValue: 1248
    },
    currency: {
        label: "Montant",
        icon: "BadgeEuro",
        helpText: "Montant formaté avec devise.",
        sampleValue: 349.9
    },
    trend: {
        label: "Tendance",
        icon: "TrendingUp",
        helpText: "Variation positive, négative ou neutre.",
        sampleValue: 12.4
    },
    progress: {
        label: "Progression",
        icon: "ChartNoAxesColumnIncreasing",
        helpText: "Pourcentage avec barre de progression.",
        sampleValue: 68
    },
    state: {
        label: "Statut",
        icon: "CircleDot",
        helpText: "Statut défini par la configuration.",
        sampleValue: "active"
    },
    badge: {
        label: "Badge",
        icon: "Badge",
        helpText: "Étiquette courte mise en évidence.",
        sampleValue: "Prioritaire"
    },
    boolean: {
        label: "Oui / Non",
        icon: "ToggleRight",
        helpText: "Réponse Oui / Non mise en évidence.",
        sampleValue: true
    },
    tags: {
        label: "Étiquettes",
        icon: "Tags",
        helpText: "Liste courte d'étiquettes.",
        sampleValue: ["urgent", "atelier", "client"]
    },
    user: {
        label: "Utilisateur",
        icon: "User",
        helpText: "Personne avec avatar textuel.",
        sampleValue: { name: "Camille Martin" }
    },
    role: {
        label: "Rôle",
        icon: "Shield",
        helpText: "Rôle avec son icône et sa couleur configurées.",
        sampleValue: { name: "Technicien", icon: "Wrench", iconColor: "--page-icon-blue" }
    },
    group: {
        label: "Groupe",
        icon: "ListChecks",
        helpText: "Résumé d'un groupe ou d'une liste.",
        sampleValue: ["Diagnostic", "Réparation", "Contrôle"]
    },
    email: {
        label: "E-mail",
        icon: "Mail",
        helpText: "Adresse e-mail avec action de contact.",
        sampleValue: "client@exemple.fr"
    },
    phone: {
        label: "Téléphone",
        icon: "Phone",
        helpText: "Numéro de téléphone avec action d'appel.",
        sampleValue: "+33 6 12 34 56 78"
    },
    priority: {
        label: "Priorité",
        icon: "Flag",
        helpText: "Priorité lisible sous forme de badge.",
        sampleValue: "Haute"
    },
    relation: {
        label: "Relation",
        icon: "Link",
        helpText: "Lien ou référence vers un autre élément.",
        sampleValue: "Élément lié"
    },
    fileCount: {
        label: "Fichiers",
        icon: "Paperclip",
        helpText: "Nombre de pièces jointes.",
        sampleValue: 3
    },
    commentCount: {
        label: "Commentaires",
        icon: "MessageSquare",
        helpText: "Nombre de commentaires.",
        sampleValue: 7
    },
    changeIndicator: {
        label: "Modification",
        icon: "History",
        helpText: "Indicateur de changement récent.",
        sampleValue: "Modifié"
    },
    quality: {
        label: "Qualité",
        icon: "BadgeCheck",
        helpText: "Score qualité synthétique.",
        sampleValue: 86
    }
} as const satisfies Record<DisplayValueKind, TableDisplayConfig>;

export type TableCellDisplay = DisplayValueKind;

export const tableCellDisplayOptions = Object.entries(TABLE_CELL_DISPLAYS).map(([value, config]) => ({
    value,
    label: config.label,
    icon: config.icon,
    helpText: config.helpText
}));

export function renderTableCell({ value, setting, states = [], dynamicGroup = null }: TableDisplayContext) {
    return createRender(DisplayValue, {
        value,
        display: setting?.display ?? setting?.displayValue,
        setting,
        states,
        dynamicGroup
    });
}
