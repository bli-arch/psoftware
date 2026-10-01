import { apiDownloadDocument, apiGet, apiPost } from "$lib/api";
import { appSettings } from "$lib/settings";
import { createTrackingLabelPdf, resolveTrackingLabelFields } from "$lib/trackingLabel";
import { get } from "svelte/store";

export type DocumentType = "receipt" | "invoice" | "credit_note" | "tracking_label";
export type DocumentStatus = "draft" | "issued" | "cancelled";

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
    receipt: "Reçu de prise en charge",
    invoice: "Facture",
    credit_note: "Avoir",
    tracking_label: "Étiquette de suivi",
};

export type OperationDocument = {
    id: number;
    document_type: DocumentType;
    status: DocumentStatus;
    number: string | null;
    operation: number;
    snapshot?: {
        presentation?: {
            format?: string;
            width_mm?: number;
            height_mm?: number;
        };
    };
    payload_hash: string;
    pdf_hash: string;
    pdf_file: string;
    issued_at: string | null;
    created_at: string;
};

export type ReceiptVerification = {
    valid: true;
    operation_uid: string;
};

function listPayload(response: unknown): OperationDocument[] {
    if (response && typeof response === "object" && "results" in response) {
        const results = (response as { results?: unknown }).results;
        return Array.isArray(results) ? results as OperationDocument[] : [];
    }
    return Array.isArray(response) ? response as OperationDocument[] : [];
}

export async function listDocuments(operationId: number) {
    return listPayload(await apiGet(`/core/documents/?operation=${operationId}`));
}

export function createReceipt(operationUid: string) {
    return apiPost("/core/documents/receipt/", { operation_uid: operationUid }) as Promise<OperationDocument>;
}

function arrayBufferToBase64(data: ArrayBuffer) {
    const bytes = new Uint8Array(data);
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
}

export async function createTrackingLabel(operationUid: string, operationValue?: unknown) {
    const documents = get(appSettings).value.documents;
    if (!documents.trackingLabelEnabled) throw new Error("Tracking labels are disabled.");

    const operation = operationValue ?? await apiGet(`/core/operations/${encodeURIComponent(operationUid)}/`);
    const fields = resolveTrackingLabelFields(documents.trackingLabelFields, operation);
    if (fields.length === 0) throw new Error("No tracking label fields are configured.");

    const pdfData = await createTrackingLabelPdf(
        fields,
        documents.trackingLabelWidthMm,
        documents.trackingLabelHeightMm,
    );
    const document = await apiPost("/core/documents/tracking-label/", {
        operation_uid: operationUid,
        pdf_base64: arrayBufferToBase64(pdfData),
    }) as OperationDocument;
    return { document, pdfData };
}

export function downloadDocumentPDF(documentId: number) {
    return apiDownloadDocument(documentId);
}

export function verifyReceiptBarcode(value: string) {
    const token = value.startsWith("91") ? value.slice(2) : value;
    return apiGet(`/core/documents/receipt/verify/${encodeURIComponent(token)}/`) as Promise<ReceiptVerification>;
}
