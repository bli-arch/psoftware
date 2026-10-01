import { setupDataTable, type DataTableSetting } from "$lib/components/table/createTable";
import type { TableSortKey } from "$lib/components/table/orderingPreference";
import {
    getTeamMembers,
    memberDisplayName,
    memberRoleDisplay,
    type TeamMemberSummary,
    type TeamRoleDisplay,
} from "$lib/team";
import { writable } from "svelte/store";

export interface TeamMemberRow extends TeamMemberSummary {
    [key: string]: unknown;
    identity: { name: string; username: string; color: string };
    roleDisplay: TeamRoleDisplay;
    accountState: "active" | "invited" | "inactive";
}

export const TEAM_TABLE_SETTINGS: DataTableSetting[] = [
    { id: 1, title: "Utilisateur", dataOrigin: "identity", display: "user" },
    { id: 2, title: "Identifiant", dataOrigin: "username", display: "text" },
    { id: 3, title: "Rôle", dataOrigin: "roleDisplay", display: "role" },
    { id: 4, title: "État", dataOrigin: "accountState", display: "state" },
    { id: 5, title: "Créé le", dataOrigin: "createdAt", display: "date", format: "%d/%m/%Y" },
];

export const TEAM_ORDERING_FIELDS: Record<string, string> = {
    identity: "name",
    username: "username",
    roleDisplay: "role",
    createdAt: "created_at",
};

export const TEAM_ACCOUNT_STATES: Array<Record<string, unknown>> = [
    { id: "active", name: "Actif", settings: { color: "--green", icon: "CircleCheck" } },
    { id: "invited", name: "Invitation", settings: { color: "--orange", icon: "Clock3" } },
    { id: "inactive", name: "Désactivé", settings: { color: "--red", icon: "CircleOff" } },
];

export const serverItemCount = writable(0);
export const isLoading = writable(false);

let pendingRequests = 0;

function normalizeMember(member: TeamMemberSummary): TeamMemberRow {
    return {
        ...member,
        identity: { name: memberDisplayName(member), username: member.username, color: member.color },
        roleDisplay: memberRoleDisplay(member),
        accountState: member.isActive ? (member.isNew ? "invited" : "active") : "inactive",
    };
}

export async function getTeamRows(
    page = 1,
    limit = 15,
    query: Record<string, string | number | undefined> = {},
) {
    pendingRequests += 1;
    isLoading.set(true);

    try {
        const params = new URLSearchParams({
            limit: String(limit),
            offset: String((page - 1) * limit),
        });
        for (const [key, value] of Object.entries(query)) {
            if (value !== undefined && value !== "" && value !== "all") params.set(key, String(value));
        }

        const response = await getTeamMembers(params);
        const rows = Array.isArray(response.results) ? response.results.map(normalizeMember) : [];
        const count = Number(response.count);
        return { rows, count: Number.isFinite(count) && count >= 0 ? count : rows.length };
    } finally {
        pendingRequests = Math.max(0, pendingRequests - 1);
        isLoading.set(pendingRequests > 0);
    }
}

export function setupTable(
    initialData: TeamMemberRow[],
    columnWidths: Record<string, number> = {},
    pageSize = 15,
    initialSortKeys: TableSortKey[] = [],
) {
    return setupDataTable<TeamMemberRow>({
        initialData,
        tableSettings: TEAM_TABLE_SETTINGS,
        pageSize,
        serverItemCount,
        columnWidths,
        orderingMap: TEAM_ORDERING_FIELDS,
        states: TEAM_ACCOUNT_STATES,
        initialSortKeys,
    });
}
