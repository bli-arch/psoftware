import { derived, writable } from 'svelte/store';
import { type InputType } from '$lib/components/istyler';

export const dragSize = writable<number[]>([1, 1]);
export const dragType = writable<InputType | null>(null);
export const FORM_BUILDER_DRAG_TYPE = "application/x-psoft-formbuilder";

export type Item = {
    name: string;
    type: InputType;
    size: number[]; // [width, height]
    icon: any;
    props?: Record<string, any>;
}

export type DroppedItem = {
    id: string;
    type: InputType;
    gx: number;
    gy: number;
    w: number;
    h: number;
    config?: Record<string, string | boolean | number>;
    props?: any;
    items?: DroppedItem[];
}

export type Page = {
    title: string;
    description: string;
    icon?: string;
    iconColor?: string;
    type: "data" | "client";
    items: DroppedItem[];
}

export const pages = writable<Page[]>([{ title: "Informations générales", description: "Informations principales.", type: "data", items: [] }]);
export const currentPage = writable<number>(0);

const serializePages = (value: Page[]) => JSON.stringify(value);

export const savedPagesSnapshot = writable<string | null>(null);
export const pagesSaved = derived(
    [pages, savedPagesSnapshot],
    ([$pages, $savedPagesSnapshot]) => $savedPagesSnapshot !== null && serializePages($pages) === $savedPagesSnapshot
);

export function markPagesSaved(value: Page[]) {
    savedPagesSnapshot.set(serializePages(value));
}

export function markPagesUnsaved() {
    savedPagesSnapshot.set(null);
}
