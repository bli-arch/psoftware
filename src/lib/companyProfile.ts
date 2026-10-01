import { apiGet, apiPatch } from "$lib/api";
import { syncCompanyBranding } from "$lib/companyBranding";
import { writable } from "svelte/store";

export const DEFAULT_PRIVACY_NOTICE = `Le responsable du traitement est l’entreprise dont les informations légales sont enregistrées dans PSoft. Ses coordonnées sont celles renseignées dans la rubrique « Coordonnées publiques ».

Les données personnelles recueillies lors de la création et du suivi d’un dossier client sont utilisées pour gérer la relation client, les opérations, les communications et les documents associés. Selon le traitement concerné, elles reposent sur l’exécution de mesures précontractuelles ou du contrat, le respect d’obligations légales ou l’intérêt légitime de l’entreprise à assurer le suivi de son activité.

Seuls les membres habilités de l’entreprise et, lorsque nécessaire, ses prestataires autorisés peuvent accéder à ces données. Elles sont conservées pendant la relation commerciale, puis archivées pendant les durées imposées par la loi ou nécessaires à la constatation, à l’exercice ou à la défense de droits en justice.

Vous pouvez demander l’accès, la rectification, l’effacement ou la limitation de vos données, demander leur portabilité lorsque ce droit s’applique, ou vous opposer à certains traitements. Vous pouvez exercer vos droits à l’aide des coordonnées publiques de l’entreprise. Vous pouvez également introduire une réclamation auprès de la CNIL sur www.cnil.fr.`;

export const PRIVACY_NOTICE_REQUIRED_CODE = "privacy_notice_unconfirmed";

export type CompanyProfile = {
    id: number;
    legal_name: string;
    display_name: string;
    main_color: string;
    legal_form: string;
    share_capital_amount: string | null;
    country_code: string;
    siren: string;
    siret: string;
    vat_number: string;
    registration_mention: string;
    registered_address_line1: string;
    registered_address_line2: string;
    registered_postal_code: string;
    registered_city: string;
    registered_region: string;
    registered_country_code: string;
    billing_address_line1: string;
    billing_address_line2: string;
    billing_postal_code: string;
    billing_city: string;
    billing_region: string;
    billing_country_code: string;
    contact_email: string;
    contact_phone: string;
    website_url: string;
    is_vat_registered: boolean;
    vat_regime: string;
    vat_exemption_mention: string;
    default_invoice_currency: "EUR" | "USD" | "GBP" | "CHF";
    date_format: "dd/MM/yyyy" | "yyyy-MM-dd" | "dd MMM yyyy";
    number_locale: "fr-FR" | "en-US";
    default_payment_terms_days: number;
    early_payment_discount_text: string;
    late_payment_penalty_text: string;
    recovery_indemnity_amount: string;
    privacy_notice: string;
    privacy_notice_confirmed: boolean;
    einvoicing_platform_kind: "unknown" | "none" | "pa" | "od";
    einvoicing_platform_name: string;
    einvoicing_platform_identifier: string;
    einvoicing_routing_identifier: string;
    extra: Record<string, unknown>;
    logo_png_file: string;
    logo_svg_file: string;
    logo_hash: string;
    version: number;
    created_at: string;
    updated_at: string;
    updated_by: number | null;
};

export const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
    id: 1,
    legal_name: "PSoft",
    display_name: "",
    main_color: "#111827",
    legal_form: "",
    share_capital_amount: null,
    country_code: "FR",
    siren: "",
    siret: "",
    vat_number: "",
    registration_mention: "",
    registered_address_line1: "",
    registered_address_line2: "",
    registered_postal_code: "",
    registered_city: "",
    registered_region: "",
    registered_country_code: "FR",
    billing_address_line1: "",
    billing_address_line2: "",
    billing_postal_code: "",
    billing_city: "",
    billing_region: "",
    billing_country_code: "",
    contact_email: "",
    contact_phone: "",
    website_url: "",
    is_vat_registered: true,
    vat_regime: "",
    vat_exemption_mention: "",
    default_invoice_currency: "EUR",
    date_format: "dd/MM/yyyy",
    number_locale: "fr-FR",
    default_payment_terms_days: 30,
    early_payment_discount_text: "",
    late_payment_penalty_text: "",
    recovery_indemnity_amount: "40.00",
    privacy_notice: DEFAULT_PRIVACY_NOTICE,
    privacy_notice_confirmed: false,
    einvoicing_platform_kind: "unknown",
    einvoicing_platform_name: "",
    einvoicing_platform_identifier: "",
    einvoicing_routing_identifier: "",
    extra: {},
    logo_png_file: "",
    logo_svg_file: "",
    logo_hash: "",
    version: 1,
    created_at: "",
    updated_at: "",
    updated_by: null,
};

export const companyProfile = writable<CompanyProfile | null>(null);

export function setCompanyProfile(profile: CompanyProfile) {
    companyProfile.set(profile);
    syncCompanyBranding({
        companyName: profile.display_name.trim() || profile.legal_name,
        logoHash: profile.logo_hash,
    });
}

export function isPrivacyNoticeReady(profile: CompanyProfile | null | undefined): boolean {
    return Boolean(profile?.privacy_notice_confirmed && profile.privacy_notice.trim());
}

export function isPrivacyNoticeRequiredError(error: unknown): boolean {
    if (!error || typeof error !== "object") return false;
    const apiError = error as { status?: number; data?: { code?: unknown } };
    return apiError.status === 409 && apiError.data?.code === PRIVACY_NOTICE_REQUIRED_CODE;
}

export async function loadCompanyProfile(): Promise<CompanyProfile> {
    const profile = await apiGet("/settings/company-profile") as CompanyProfile;
    setCompanyProfile(profile);
    return profile;
}

export async function updateCompanyProfile(patch: Partial<CompanyProfile>): Promise<CompanyProfile> {
    const profile = await apiPatch("/settings/company-profile", patch as Record<string, unknown>) as CompanyProfile;
    setCompanyProfile(profile);
    return profile;
}
