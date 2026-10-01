import { browser } from "$app/environment";
import { invoke } from "@tauri-apps/api/core";
import { getServerConfig, type DatabaseConfig, type ServerConfig } from "$lib/onboarding";

export type ServerInstallerOptions = {
    licenseKey: string;
    adminUsername?: string;
    adminPassword: string;
    dataDir?: string;
    expectedSha256?: string;
    databasePassword?: string;
};

export type CertificateInstallResult = {
    installed: boolean;
    store: string;
    detail: string;
};

type InstallerDatabaseConfig =
    | { type: "sqlite"; path: string }
    | {
        type: "postgres";
        host: string;
        port: number;
        database: string;
        username: string;
        password?: string;
        sslMode: "disable" | "require" | "verify-full";
        sslRootCertificate?: string;
    };

export function canLaunchServerInstaller() {
    return browser && "__TAURI_INTERNALS__" in window;
}

export async function launchConfiguredServerInstaller(options: ServerInstallerOptions) {
    const config = getServerConfig();
    if (!config) {
        throw new Error("No server configuration has been saved on this device.");
    }

    return launchServerInstaller(config, options);
}

export async function launchServerInstaller(config: ServerConfig, options: ServerInstallerOptions) {
    if (!canLaunchServerInstaller()) {
        throw new Error("Server installation is available only from the installed PSoft desktop app.");
    }

    return invoke<string>("launch_server_installer", {
        request: {
            serverName: config.serverName,
            bindAddress: config.bindAddress,
            publicUrl: publicUrlFromApiBase(config.apiBaseUrl),
            database: installerDatabase(config.database, options.databasePassword),
            licenseKey: options.licenseKey,
            adminUsername: options.adminUsername,
            adminPassword: options.adminPassword,
            dataDir: options.dataDir,
            expectedSha256: options.expectedSha256,
            discoveryEnabled: config.discoveryEnabled,
            discoveryHostname: config.discoveryHostname,
        },
    });
}

export function verifyPServerLicense(licenseKey: string): Promise<void> {
    if (!canLaunchServerInstaller()) {
        throw new Error("La vérification de licence est disponible uniquement dans l'application Windows.");
    }

    return invoke("verify_pserver_license", { licenseKey });
}

export function refreshLocalPServerCaCertificate(expectedServerId: string): Promise<CertificateInstallResult> {
    if (!canLaunchServerInstaller()) {
        throw new Error("Certificate installation is available only from the installed PSoft desktop app.");
    }

    return invoke<CertificateInstallResult>("refresh_local_pserver_ca_certificate", { expectedServerId });
}

function publicUrlFromApiBase(apiBaseUrl: string) {
    const parsed = new URL(apiBaseUrl);
    parsed.pathname = parsed.pathname.replace(/\/api\/v1\/?$/, "").replace(/\/api\/?$/, "") || "/";
    parsed.search = "";
    parsed.hash = "";

    return parsed.toString().replace(/\/$/, "");
}

function installerDatabase(database: DatabaseConfig, password?: string): InstallerDatabaseConfig {
    if (database.type === "sqlite") {
        return database;
    }

    return {
        ...database,
        password,
    };
}
