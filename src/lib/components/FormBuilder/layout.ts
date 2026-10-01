import { recordList } from "$lib/formConfig";
import type { InputType } from "$lib/components/istyler";

export const FORM_COLUMNS = 64;
export const FORM_ROW_HEIGHT = 20;
export const DEFAULT_FIELD_SIZES: Record<InputType, [number, number]> = {
    checkbox: [16, 14],
    date: [16, 5],
    dynamicgroup: [32, 12],
    iconpicker: [16, 4],
    number: [16, 4],
    password: [16, 4],
    radio: [16, 14],
    range: [16, 6],
    select: [16, 4],
    text: [16, 4],
    textarea: [16, 8],
};

export const getFormFields = (page: any) =>
    recordList(Array.isArray(page?.formFields) ? page.formFields : page?.items);

export const getFieldGridStyle = (field: any) => {
    const gx = Number(field?.gx ?? 0);
    const gy = Number(field?.gy ?? 0);
    const w = Math.max(1, Number(field?.w ?? 1));
    const h = Math.max(1, Number(field?.h ?? 1));

    return `grid-column: ${gx + 1} / span ${w}; grid-row: ${gy + 1} / span ${h};`;
};

export const getGridX = (event: MouseEvent | DragEvent, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const ratio = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
    return Math.floor(Math.max(0, Math.min(ratio, 1)) * FORM_COLUMNS);
};

export const getGridY = (event: MouseEvent | DragEvent, element: HTMLElement) => {
    const top = element.getBoundingClientRect().top;
    return Math.max(0, Math.floor((event.clientY - top) / FORM_ROW_HEIGHT));
};
