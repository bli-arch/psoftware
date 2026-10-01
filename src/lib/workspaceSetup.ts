export const CLIENT_IDENTIFIER = "CL-%4N%";
export const OPERATION_IDENTIFIER = "OP-%4N%";

export const CLIENT_COLUMNS = [
    { id: 1, title: "Identifiant", dataOrigin: "uid", display: "identifier" },
    { id: 2, title: "Créé le", dataOrigin: "created_at", display: "date", format: "%d/%m/%Y" },
];

export const OPERATION_COLUMNS = [
    { id: 1, title: "Identifiant", dataOrigin: "uid", display: "identifier" },
    { id: 2, title: "Client", dataOrigin: "client.uid", display: "identifier" },
    { id: 3, title: "Statut", dataOrigin: "state", display: "state" },
    { id: 4, title: "Créé le", dataOrigin: "created_at", display: "date", format: "%d/%m/%Y" },
];
