import { apiDelete, apiGet, apiPatch, apiPost } from "$lib/api";

export const TEAM_LIST_PERMISSIONS = [
    "users.invite",
    "users.modify",
    "users.disable",
    "users.export",
    "users.delete",
] as const;

export const TEAM_DETAIL_PERMISSIONS = [
    "users.modify",
    "users.disable",
    "users.export",
    "users.delete",
] as const;

export type TeamRoleSummary = {
    id: number;
    name: string | null;
    icon: string;
    iconColor: string;
};

export type TeamRole = TeamRoleSummary & {
    permissionKeys: string[];
    assignable?: boolean;
};

export type TeamRoleDisplay = TeamRoleSummary & { isSuperuser?: boolean };

export type TeamMemberSummary = {
    id: number;
    username: string;
    name: string;
    lastname: string;
    color: string;
    role: TeamRoleSummary | null;
    isAdmin: boolean;
    isSuperuser: boolean;
    isActive: boolean;
    isNew: boolean;
    self: boolean;
    createdAt: string;
};

export type TeamMember = TeamMemberSummary & {
    mail: string;
    phone: string;
    activeSessions: number;
    quickLogin?: {
        hasPin: boolean;
        hasBadge: boolean;
        badgeEnabled: boolean;
    };
};

export type TeamSession = {
    id: string;
    current: boolean;
    device: string;
    deviceType: "personal" | "shared" | null;
    status: string;
    expiresAt: string;
    loginAt: string | null;
    ipAddress: string;
};

export type Paginated<T> = {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
};

export type TeamMemberPatch = Partial<Pick<TeamMember, "username" | "name" | "lastname" | "mail" | "phone" | "color" | "isActive">> & {
    role?: number;
};

export type NewTeamMember = {
    name: string;
    lastname: string;
    username: string;
    password: string;
    role: number;
};

export function memberDisplayName(member: Pick<TeamMember, "name" | "lastname" | "username">) {
    return [member.name, member.lastname].filter(Boolean).join(" ").trim() || member.username;
}

export function memberRoleDisplay(
    member: Pick<TeamMemberSummary, "role" | "isAdmin" | "isSuperuser">,
): TeamRoleDisplay {
    if (member.isSuperuser) {
        return { id: 0, name: "Super-administrateur", icon: "", iconColor: "--user-color", isSuperuser: true };
    }
    if (member.role) return member.role;
    if (member.isAdmin) return { id: 0, name: "Administrateur", icon: "Shield", iconColor: "--user-color" };
    return { id: 0, name: "Sans rôle", icon: "ShieldQuestion", iconColor: "--grey" };
}

export function asList<T>(response: unknown): T[] {
    if (Array.isArray(response)) return response as T[];
    if (response && typeof response === "object" && Array.isArray((response as { results?: unknown }).results)) {
        return (response as { results: T[] }).results;
    }
    return [];
}

export function teamRequestError(error: unknown, fallback: string) {
    if (!error || typeof error !== "object" || !("data" in error)) return fallback;
    const data = (error as { data?: unknown }).data;
    if (!data || typeof data !== "object") return fallback;
    const payload = data as Record<string, unknown>;
    if (typeof payload.detail === "string") return payload.detail;
    for (const value of Object.values(payload)) {
        if (Array.isArray(value) && typeof value[0] === "string") return value[0];
        if (typeof value === "string") return value;
    }
    return fallback;
}

export async function getTeamMembers(params: URLSearchParams) {
    return apiGet(`/auth/users/?${params.toString()}`) as Promise<Paginated<TeamMemberSummary>>;
}

export async function getTeamMember(id: number | string) {
    return apiGet(`/auth/users/${encodeURIComponent(String(id))}/`) as Promise<TeamMember>;
}

export async function updateTeamMember(id: number, patch: TeamMemberPatch) {
    return apiPatch(`/auth/users/${id}/`, patch) as Promise<TeamMember>;
}

export async function getAssignableRoles() {
    const response = await apiGet("/auth/role/?limit=100");
    return asList<Partial<TeamRole>>(response)
        .map((role) => ({
            id: Number(role.id),
            name: typeof role.name === "string" ? role.name : null,
            icon: typeof role.icon === "string" && role.icon ? role.icon : "Shield",
            iconColor: typeof role.iconColor === "string" && role.iconColor ? role.iconColor : "--page-icon-purple",
            permissionKeys: Array.isArray(role.permissionKeys)
                ? [...new Set(role.permissionKeys.filter((key): key is string => typeof key === "string"))]
                : [],
            assignable: role.assignable !== false,
        }))
        .filter((role) => Number.isSafeInteger(role.id) && role.id > 0 && role.assignable);
}

export async function createTeamMember(member: NewTeamMember) {
    return apiPost("/auth/register/", member) as Promise<{ id: number; username: string }>;
}

export async function resetTeamMemberPassword(
    id: number,
    currentPassword: string,
    password: string,
    confirmation: string,
) {
    return apiPost(`/auth/users/${id}/password/`, {
        current_password: currentPassword,
        password,
        password_confirmation: confirmation,
    });
}

export async function revokeTeamMemberQuickLogin(id: number) {
    return apiDelete(`/auth/users/${id}/quick-login/`);
}

export async function getTeamMemberSessions(id: number) {
    return apiGet(`/auth/users/${id}/sessions/`) as Promise<{ count: number; sessions: TeamSession[] }>;
}

export async function revokeTeamMemberSessions(id: number, sessionId?: string) {
    const query = sessionId ? `?id=${encodeURIComponent(sessionId)}` : "";
    return apiDelete(`/auth/users/${id}/sessions/${query}`);
}

export async function exportTeamMemberData(id: number, currentPassword: string) {
    return apiPost(`/auth/users/${id}/data-export/`, { current_password: currentPassword }) as Promise<Record<string, unknown>>;
}

export async function eraseTeamMemberData(id: number, username: string, currentPassword: string) {
    return apiPost(`/auth/users/${id}/data-erasure/`, {
        confirm_username: username,
        current_password: currentPassword,
    });
}
