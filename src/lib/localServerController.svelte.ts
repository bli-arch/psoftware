import {
    canUseLocalServerService,
    friendlyLocalServerServiceError,
    getCachedLocalServerServiceStatus,
    getLocalServerServiceStatus,
    runLocalServerServiceAction,
    type LocalServerServiceAction,
    type LocalServerServiceStatus,
} from "$lib/localServerService";
import { strftime } from "$lib/utils";

export function createLocalServerController(options: {
    connectedServerId?: () => string | null;
} = {}) {
    const initialService = getCachedLocalServerServiceStatus();
    const supported = canUseLocalServerService();
    let service = $state<LocalServerServiceStatus | null>(initialService);
    let serviceResolved = $state(initialService !== null || !supported);
    let serviceChecking = $state(false);
    let serviceAction = $state<LocalServerServiceAction | null>(null);
    let serviceError = $state("");
    let serviceCheckedAt = $state(initialService ? currentTime() : "");

    function currentTime() {
        return strftime(new Date(), "%H:%M:%S");
    }

    async function refreshService(clearError = true) {
        if (!supported) return null;

        serviceChecking = true;
        if (clearError) serviceError = "";
        try {
            service = await getLocalServerServiceStatus();
            return service;
        } catch (error) {
            console.error("Failed to check local PServer", error);
            service = null;
            if (clearError) serviceError = "Impossible de vérifier l’état du service PServer.";
            return null;
        } finally {
            serviceResolved = true;
            serviceCheckedAt = currentTime();
            serviceChecking = false;
        }
    }

    async function controlServer(
        action: LocalServerServiceAction,
        afterAction?: (status: LocalServerServiceStatus) => void | Promise<void>,
    ) {
        serviceAction = action;
        serviceError = "";
        try {
            const status = await runLocalServerServiceAction(action, options.connectedServerId?.());
            service = status;
            serviceCheckedAt = currentTime();
            if (afterAction) {
                void Promise.resolve()
                    .then(() => afterAction(status))
                    .catch((error) => console.error("Failed to refresh PServer state after service action", error));
            }
            return status;
        } catch (error) {
            const cancelled = String(error).trim() === "Accès refusé.";
            if (!cancelled) console.error(`Failed to ${action} local PServer`, error);

            const recovered = await refreshService(false);
            if (cancelled) return null;

            const expectedState = action === "stop" ? "stopped" : "running";
            if (recovered?.state === expectedState) {
                serviceError = "";
                return recovered;
            }
            serviceError = friendlyLocalServerServiceError();
            return null;
        } finally {
            serviceAction = null;
        }
    }

    return {
        get supported() { return supported; },
        get service() { return service; },
        get serviceResolved() { return serviceResolved; },
        get serviceChecking() { return serviceChecking; },
        get serviceAction() { return serviceAction; },
        get serviceError() { return serviceError; },
        get serviceCheckedAt() { return serviceCheckedAt; },
        get busy() { return serviceAction !== null; },
        refreshService,
        controlServer,
    };
}
