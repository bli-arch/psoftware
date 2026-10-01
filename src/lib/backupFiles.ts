import { invoke } from "@tauri-apps/api/core";

function encodeHeader(value: string) {
    return btoa(String.fromCharCode(...new TextEncoder().encode(value)));
}

export async function saveFile(
    data: Blob | ArrayBuffer,
    filename: string,
    description: string,
    extension: string,
) {
    return invoke<boolean>("save_file", data instanceof Blob ? await data.arrayBuffer() : data, {
        headers: {
            "x-psoft-filename": encodeHeader(filename),
            "x-psoft-description": encodeHeader(description),
            "x-psoft-extension": encodeHeader(extension),
        },
    });
}

export function backupRecoveryKeyFile(key: string) {
    return new Blob([`Clé de récupération des sauvegardes PSoft\n${key}\n`], { type: "text/plain;charset=utf-8" });
}
