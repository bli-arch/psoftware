import { get, writable } from "svelte/store";

export type AuthUser = {
    id?: number;
    username: string;
    name?: string;
    lastname?: string;
    color?: string;
    administrator?: boolean;
    isNew?: boolean;
    permissions?: string[];
};

let authenticated = false;
export const currentUser = writable<AuthUser | null>(null);

export function isAuthenticated() {
    return authenticated;
}

export function setAuthState(value: boolean, user: AuthUser | null = null) {
    authenticated = value;
    currentUser.set(value ? user : null);
}

export function clearAuthState() {
    setAuthState(false);
}

export function hasPermission(key: string) {
    const user = get(currentUser);
    return Boolean(user?.administrator || user?.permissions?.includes(key));
}

export function hasAnyPermission(keys: string[]) {
    return keys.some(hasPermission);
}
