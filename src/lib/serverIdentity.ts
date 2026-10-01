export type PServerIdentity = {
    serverId: string;
    serverName: string;
};

export function isPServerId(value: unknown): value is string {
    return typeof value === "string"
        && /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(value);
}
