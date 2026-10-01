export type IconPickerCategory = {
    name: string;
    terms: string[];
};

export const iconPickerCategories: IconPickerCategory[] = [
    { name: "Accessibilité", terms: ["accessibility", "ear", "eye", "hand", "scan eye", "person standing"] },
    { name: "Compte & accès", terms: ["user", "users", "id", "badge", "key", "lock", "unlock", "fingerprint", "shield"] },
    { name: "Animaux", terms: ["bird", "bug", "cat", "dog", "fish", "rabbit", "rat", "snail", "squirrel", "turtle", "worm"] },
    { name: "Flèches", terms: ["arrow", "chevron", "corner", "move", "redo", "refresh", "repeat", "rewind", "rotate", "shuffle", "undo"] },
    { name: "Batiments", terms: ["building", "castle", "church", "factory", "hospital", "hotel", "landmark", "school", "store", "warehouse"] },
    { name: "Graphiques", terms: ["activity", "chart", "gauge", "goal", "kanban", "pie", "presentation", "trending"] },
    { name: "Communication", terms: ["at sign", "bell", "mail", "message", "mic", "phone", "send", "speech", "voicemail"] },
    { name: "Connectivité", terms: ["bluetooth", "broadcast", "cast", "cloud", "ethernet", "podcast", "radio", "rss", "satellite", "signal", "wifi"] },
    { name: "Design", terms: ["brush", "component", "drafting", "eraser", "figma", "frame", "layers", "paint", "palette", "pen", "pencil", "pipette", "swatch"] },
    { name: "Développement", terms: ["binary", "bot", "braces", "brackets", "bug", "code", "cpu", "database", "file code", "git", "terminal", "webhook"] },
    { name: "Appareils", terms: ["battery", "camera", "computer", "disc", "hard drive", "keyboard", "laptop", "monitor", "mouse", "printer", "router", "smartphone", "tablet", "tv", "usb"] },
    { name: "Émojis", terms: ["angry", "annoyed", "frown", "laugh", "meh", "smile"] },
    { name: "Fichiers", terms: ["archive", "book", "clipboard", "copy", "file", "folder", "notebook", "paperclip", "save", "scroll"] },
    { name: "Finance", terms: ["banknote", "bitcoin", "circle dollar", "coins", "credit card", "euro", "landmark", "pound", "receipt", "wallet"] },
    { name: "Alimentation & boissons", terms: ["apple", "banana", "bean", "beer", "cake", "candy", "chef", "cherry", "coffee", "croissant", "egg", "ice cream", "pizza", "salad", "sandwich", "soup", "utensils"] },
    { name: "Jeux vidéo", terms: ["club", "dice", "gamepad", "joystick", "puzzle", "spade", "sword", "trophy"] },
    { name: "Maison", terms: ["bath", "bed", "door", "house", "lamp", "sofa", "toilet", "washing"] },
    { name: "Mise en page", terms: ["align", "columns", "grid", "layout", "list", "panel", "rows", "sidebar", "table"] },
    { name: "Médical", terms: ["ambulance", "bandage", "dna", "heart pulse", "pill", "syringe", "stethoscope", "test tube"] },
    { name: "Multimédia", terms: ["audio", "captions", "circle play", "film", "image", "music", "pause", "play", "video", "volume"] },
    { name: "Nature", terms: ["bean", "cactus", "flower", "leaf", "mountain", "sprout", "tree", "waves"] },
    { name: "Navigation", terms: ["anchor", "compass", "flag", "locate", "map", "milestone", "navigation", "route", "signpost"] },
    { name: "Personnes", terms: ["baby", "contact", "person", "smile plus", "user round"] },
    { name: "Photographie", terms: ["aperture", "camera", "focus", "gallery", "image", "scan", "scan line", "sliders"] },
    { name: "Science", terms: ["atom", "beaker", "brain", "flask", "microscope", "orbit", "rocket"] },
    { name: "Formes", terms: ["box", "circle", "cone", "cuboid", "diamond", "hexagon", "octagon", "pentagon", "square", "triangle"] },
    { name: "Achats", terms: ["barcode", "package", "scan barcode", "shopping", "tag", "ticket"] },
    { name: "Sports", terms: ["bike", "dumbbell", "medal", "sailboat", "ship wheel", "volleyball"] },
    { name: "Texte", terms: ["case", "heading", "letter", "pilcrow", "quote", "signature", "spell", "text", "type"] },
    { name: "Temps & calendrier", terms: ["alarm", "calendar", "clock", "history", "hourglass", "timer", "watch"] },
    { name: "Outils", terms: ["anvil", "axe", "construction", "drill", "hammer", "pickaxe", "ruler", "scissors", "settings", "wrench"] },
    { name: "Transports", terms: ["bus", "car", "plane", "ship", "train", "tram", "truck"] },
    { name: "Voyage", terms: ["baggage", "briefcase", "camping", "luggage", "map pinned", "tent", "tickets"] },
    { name: "Météo", terms: ["cloud", "droplet", "flame", "moon", "rainbow", "snowflake", "sun", "thermometer", "tornado", "umbrella", "wind"] },
];

const keywordGroups = [
    // Utilisateur / comptes / profil
    [
        [
            "accès", "compte", "profil", "personne", "utilisateur", "usager", "membre",
            "client", "employé", "collaborateur", "équipe", "groupe", "identité",
            "avatar", "contact", "fiche", "interlocuteur", "responsable", "agent",
            "technicien", "administrateur", "admin", "rôle", "poste"
        ],
        [
            "User", "UserRound", "Users", "Contact", "IdCard", "Badge", "CircleUser",
            "UserCheck", "UserRoundCheck", "BookUser", "BadgeCheck"
        ],
    ],

    // Sécurité / permissions / authentification
    [
        [
            "sécurité", "permission", "permissions", "privé", "confidentiel", "secret",
            "mot de passe", "authentification", "connexion", "déconnexion", "login",
            "verrou", "verrouillé", "déverrouillé", "clé", "empreinte", "protection",
            "autorisation", "droits", "accès refusé", "restriction", "cadenas"
        ],
        [
            "Shield", "ShieldCheck", "KeyRound", "Lock", "Unlock", "Fingerprint",
            "ShieldAlert", "BadgeAlert"
        ],
    ],

    // Client / CRM / contact
    [
        [
            "client", "contact", "fiche", "identité", "prospect", "crm", "relation",
            "personne", "coordonnées", "annuaire", "répertoire", "carnet", "adresse",
            "interlocuteur", "profil client", "dossier client"
        ],
        [
            "Contact", "UserRoundCheck", "UserCheck", "NotebookTabs", "BookUser",
            "IdCard", "Mail", "Phone"
        ],
    ],

    // Opérations / interventions / tickets
    [
        [
            "opération", "intervention", "mission", "travail", "ticket", "tâche",
            "action", "traitement", "suivi", "processus", "workflow", "procédure",
            "chantier", "prestation", "service", "demande", "incident", "assignation",
            "à faire", "todo", "contrôle", "vérification", "checklist"
        ],
        [
            "ClipboardList", "ClipboardCheck", "BriefcaseBusiness", "Wrench",
            "FileCheck", "ListChecks", "CircleCheck", "SquareCheck"
        ],
    ],

    // Formulaires / saisie / édition
    [
        [
            "formulaire", "champ", "saisie", "input", "texte", "édition", "éditer",
            "modifier", "renseigner", "remplir", "questionnaire", "réponse",
            "valeur", "donnée", "case", "option", "sélection", "choix", "note",
            "commentaire", "description"
        ],
        [
            "TextCursorInput", "FileInput", "FormInput", "Rows3", "SquarePen",
            "PanelTop", "Pencil", "PenLine", "Text"
        ],
    ],

    // Documents / fichiers / dossiers
    [
        [
            "document", "fichier", "dossier", "archive", "pièce jointe", "pdf",
            "contrat", "rapport", "attestation", "certificat", "justificatif",
            "facture", "devis", "bon", "courrier", "papier", "page", "scan",
            "téléchargement", "import", "export", "copie", "modèle", "template"
        ],
        [
            "File", "FileText", "Files", "Folder", "FolderOpen", "Archive",
            "Paperclip", "ScrollText", "FileCheck", "FileInput", "Download", "Upload"
        ],
    ],

    // Sauvegarde / stockage / base de données
    [
        [
            "enregistrer", "sauver", "sauvegarde", "stockage", "disque", "base",
            "base de données", "bdd", "données", "serveur", "cloud", "mémoire",
            "backup", "restaurer", "importer", "exporter", "charger", "envoyer"
        ],
        [
            "Save", "HardDrive", "Database", "Archive", "Download", "Upload",
            "Cloud", "Server"
        ],
    ],

    // Date / temps / planning
    [
        [
            "date", "temps", "heure", "planning", "rendez-vous", "calendrier",
            "agenda", "horaire", "créneau", "durée", "retard", "avance", "historique",
            "chronologie", "période", "début", "fin", "échéance", "deadline",
            "expiration", "rappel", "alarme", "minute", "seconde", "jour", "semaine",
            "mois", "année"
        ],
        [
            "Calendar", "CalendarDays", "Clock", "AlarmClock", "Timer",
            "Hourglass", "History", "CalendarCheck", "CalendarClock"
        ],
    ],

    // Argent / paiement / facturation
    [
        [
            "prix", "paiement", "argent", "facture", "devis", "tarif", "coût",
            "montant", "total", "tva", "taxe", "remise", "réduction", "avoir",
            "acompte", "solde", "règlement", "transaction", "carte bancaire",
            "banque", "espèces", "monnaie", "budget", "dépense", "revenu",
            "comptabilité", "finance"
        ],
        [
            "Euro", "BadgeEuro", "ReceiptEuro", "ReceiptText", "Coins",
            "Wallet", "CreditCard", "Banknote", "Landmark"
        ],
    ],

    // Statistiques / rapports / performance
    [
        [
            "statistique", "rapport", "progression", "performance", "analyse",
            "tableau de bord", "dashboard", "indicateur", "kpi", "mesure",
            "score", "résultat", "tendance", "évolution", "graphique", "courbe",
            "camembert", "barres", "activité", "productivité", "objectif",
            "prévision", "suivi"
        ],
        [
            "ChartBar", "ChartPie", "ChartLine", "TrendingUp", "TrendingDown",
            "Activity", "Gauge", "Presentation"
        ],
    ],

    // Messages / communication / notifications
    [
        [
            "message", "email", "mail", "appel", "notification", "sms", "chat",
            "conversation", "discussion", "commentaire", "réponse", "envoyer",
            "réception", "boîte mail", "courriel", "téléphone", "alerte",
            "sonnerie", "mention", "support", "assistance"
        ],
        [
            "Mail", "MessageSquare", "MessagesSquare", "Phone", "Bell",
            "Send", "AtSign", "BellRing"
        ],
    ],

    // Adresse / carte / localisation
    [
        [
            "adresse", "lieu", "itinéraire", "position", "localisation", "carte",
            "map", "gps", "trajet", "route", "navigation", "distance", "coordonnées",
            "ville", "rue", "pays", "site", "zone", "secteur", "agence",
            "géolocalisation", "repère"
        ],
        [
            "MapPin", "MapPinned", "Map", "Route", "Navigation", "Compass",
            "LocateFixed", "Crosshair"
        ],
    ],

    // Boutique / produits / commandes / stock
    [
        [
            "boutique", "produit", "stock", "commande", "achat", "article",
            "catalogue", "panier", "vente", "magasin", "étiquette", "code barre",
            "référence", "sku", "colis", "emballage", "inventaire", "quantité",
            "livraison", "expédition", "réassort", "rayon"
        ],
        [
            "Package", "Boxes", "Barcode", "ScanBarcode", "ShoppingCart",
            "Store", "Tag", "Tags", "Truck"
        ],
    ],

    // Outils / maintenance / réglages
    [
        [
            "outil", "réparation", "maintenance", "diagnostic", "réglage",
            "paramètre", "configuration", "config", "option", "préférence",
            "mécanique", "bricolage", "chantier", "travaux", "dépannage",
            "installation", "matériel", "équipement", "technique", "système"
        ],
        [
            "Wrench", "Hammer", "Settings", "Cog", "Drill", "Construction",
            "Screwdriver", "SlidersHorizontal"
        ],
    ],

    // Image / photo / médias
    [
        [
            "photo", "image", "média", "caméra", "appareil photo", "galerie",
            "aperçu", "visuel", "illustration", "capture", "screenshot", "portrait",
            "logo", "icône", "scan", "objectif", "focus", "album"
        ],
        [
            "Image", "Images", "Camera", "Aperture", "Focus", "GalleryHorizontal",
            "Scan"
        ],
    ],

    // Audio / vidéo / lecture
    [
        [
            "audio", "vidéo", "lecture", "musique", "son", "volume", "film",
            "enregistrement", "micro", "pause", "play", "jouer", "streaming",
            "média", "player", "clip", "podcast"
        ],
        [
            "Video", "Film", "CirclePlay", "Play", "Pause", "Music",
            "Volume2", "Mic"
        ],
    ],

    // Bâtiments / lieux
    [
        [
            "maison", "local", "bâtiment", "adresse", "immeuble", "bureau",
            "agence", "site", "entrepôt", "usine", "commerce", "boutique",
            "magasin", "institution", "monument", "garage", "atelier",
            "résidence", "logement"
        ],
        [
            "House", "Building", "Building2", "Store", "Warehouse",
            "Factory", "Landmark"
        ],
    ],

    // Santé / médical / urgence
    [
        [
            "santé", "médical", "urgence", "soin", "médecin", "hôpital",
            "clinique", "pharmacie", "médicament", "pilule", "vaccin",
            "injection", "blessure", "pansement", "maladie", "diagnostic",
            "ambulance", "secours", "cardiaque", "pouls"
        ],
        [
            "HeartPulse", "Stethoscope", "Ambulance", "Pill", "Syringe",
            "Hospital", "Bandage", "Cross"
        ],
    ],

    // Transport / livraison / véhicules
    [
        [
            "transport", "livraison", "véhicule", "voiture", "camion", "bus",
            "train", "avion", "bateau", "vélo", "déplacement", "trajet",
            "expédition", "course", "chauffeur", "flotte", "garage",
            "mobilité", "voyage"
        ],
        [
            "Car", "Truck", "Bus", "Train", "Plane", "Ship", "Bike",
            "Package"
        ],
    ],

    // Météo / éléments
    [
        [
            "météo", "température", "eau", "feu", "soleil", "nuage", "pluie",
            "neige", "vent", "orage", "chaleur", "froid", "humidité",
            "goutte", "flamme", "thermomètre", "climat", "air", "saison"
        ],
        [
            "Sun", "Cloud", "CloudRain", "Snowflake", "Thermometer",
            "Droplet", "Flame", "Wind", "Umbrella"
        ],
    ],

    // Validation / succès
    [
        [
            "valider", "terminé", "réussi", "ok", "succès", "confirmé",
            "approuvé", "accepté", "fait", "complet", "validé", "coché",
            "correct", "disponible", "actif", "autorisé", "positif"
        ],
        [
            "Check", "CircleCheck", "BadgeCheck", "ListChecks",
            "ClipboardCheck", "SquareCheck", "CheckCheck"
        ],
    ],

    // Erreur / alerte / danger
    [
        [
            "erreur", "alerte", "attention", "danger", "problème", "incident",
            "anomalie", "échec", "bloqué", "critique", "urgent", "warning",
            "avertissement", "interdit", "refusé", "annulé", "invalide",
            "manquant", "hors ligne", "indisponible"
        ],
        [
            "CircleAlert", "TriangleAlert", "BadgeAlert", "OctagonAlert",
            "CircleX", "X", "Ban"
        ],
    ],

    // Recherche / filtre / tri
    [
        [
            "recherche", "chercher", "trouver", "filtre", "filtrer", "tri",
            "trier", "classement", "liste", "résultat", "loupe", "explorer",
            "sélectionner", "affiner", "ordre", "croissant", "décroissant",
            "a-z", "z-a"
        ],
        [
            "Search", "Filter", "ListFilter", "List", "ArrowDownAZ",
            "ArrowUpAZ", "SlidersHorizontal"
        ],
    ],

    // Navigation UI / menus
    [
        [
            "menu", "navigation", "onglet", "page", "écran", "interface",
            "sidebar", "barre latérale", "ouvrir", "fermer", "retour",
            "suivant", "précédent", "accueil", "dashboard", "vue", "affichage",
            "layout", "grille", "tableau"
        ],
        [
            "Menu", "PanelLeft", "PanelRight", "LayoutDashboard", "Grid2X2",
            "Table", "House", "ChevronLeft", "ChevronRight", "ArrowLeft",
            "ArrowRight"
        ],
    ],

    // Ajout / suppression / modification
    [
        [
            "ajouter", "addition", "nouveau", "créer", "création", "plus",
            "supprimer", "retirer", "enlever", "moins", "effacer", "modifier",
            "éditer", "mettre à jour", "changer", "dupliquer", "copier"
        ],
        [
            "Plus", "CirclePlus", "SquarePlus", "Minus", "CircleMinus",
            "Trash", "Trash2", "Pencil", "SquarePen", "Copy", "Files"
        ],
    ],

    // États / visibilité / statut
    [
        [
            "statut", "état", "visible", "invisible", "afficher", "masquer",
            "actif", "inactif", "en ligne", "hors ligne", "disponible",
            "indisponible", "favori", "épinglé", "important", "priorité",
            "info", "information", "aide"
        ],
        [
            "Eye", "EyeOff", "Circle", "CircleDot", "Star", "Pin",
            "Info", "CircleHelp", "BadgeInfo"
        ],
    ],
] as const satisfies ReadonlyArray<readonly [readonly string[], readonly string[]]>;

const normalizeKeyword = (value: string) =>
    value
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .trim();

const unique = <T,>(values: T[]) => [...new Set(values)];

const expandKeyword = (keyword: string) => {
    const normalized = normalizeKeyword(keyword);

    const variants = [
        keyword,
        normalized,
        `${normalized}s`,
        normalized.endsWith("s") ? normalized.slice(0, -1) : normalized,
    ];

    return unique(variants.filter(Boolean));
};

export const iconPickerIconKeywords = keywordGroups.reduce<Record<string, string[]>>(
    (acc, [keywords, icons]) => {
        const expandedKeywords = unique(keywords.flatMap(expandKeyword));

        icons.forEach((icon) => {
            acc[icon] = unique([...(acc[icon] ?? []), ...expandedKeywords]);
        });

        return acc;
    },
    {},
);
