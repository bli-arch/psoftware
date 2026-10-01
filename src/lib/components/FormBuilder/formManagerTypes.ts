import type { Page } from "./stores";
import { recordList } from "$lib/formConfig";

export type ManagedFormType = "operation" | "client" | "product";

export type ManagedFormPage = {
    title?: string;
    items?: unknown[];
};

export type ManagedForm = {
    id: number;
    name?: string | null;
    type?: ManagedFormType;
    form?: {
        pages?: ManagedFormPage[];
    };
    settings?: {
        name?: string | null;
        [key: string]: unknown;
    };
    is_active?: boolean | number;
    created_at?: string | Date | null;
};

export type FormFilter = "all" | "active" | "draft";

export type NewPageTemplate = Pick<Page, "title" | "description" | "icon" | "iconColor" | "type" | "items">;

export function getFormPages(form: ManagedForm): ManagedFormPage[] {
    return recordList(form.form?.pages).map((page) => ({
        ...page,
        title: typeof page.title === "string" ? page.title : "",
        items: recordList(page.items),
    })) as ManagedFormPage[];
}

export function getFormName(form: ManagedForm): string {
    const name = form.name ?? form.settings?.name;
    return typeof name === "string" && name.trim() ? name : `Formulaire #${form.id}`;
}
