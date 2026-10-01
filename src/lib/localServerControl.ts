import type { LocalServerServiceStatus } from "$lib/localServerService";
import { isPServerId } from "$lib/serverIdentity";

export function isLocalPServerInstalled(
    service: Pick<LocalServerServiceStatus, "available"> | null | undefined,
) {
    return service?.available === true;
}

export function requireLocalPServerIdentity(
    service: Pick<LocalServerServiceStatus, "available" | "serverId"> | null | undefined,
) {
    if (!isLocalPServerInstalled(service) || !isPServerId(service?.serverId)) {
        throw new Error("L’identité du PServer installé sur cet appareil est indisponible.");
    }
    return service.serverId.toLowerCase();
}

export function isConnectedToLocalPServer(
    service: Pick<LocalServerServiceStatus, "available" | "serverId"> | null | undefined,
    connectedServerId: string | null | undefined,
) {
    return service?.available === true
        && isPServerId(service.serverId)
        && isPServerId(connectedServerId)
        && service.serverId.toLowerCase() === connectedServerId.toLowerCase();
}

export function requireConnectedLocalPServer(
    service: Pick<LocalServerServiceStatus, "available" | "serverId"> | null | undefined,
    connectedServerId: string | null | undefined,
) {
    if (!isPServerId(connectedServerId) || !isConnectedToLocalPServer(service, connectedServerId)) {
        throw new Error("Action refusée: le PServer connecté n’est pas le PServer installé sur cet appareil.");
    }
    return connectedServerId.toLowerCase();
}
