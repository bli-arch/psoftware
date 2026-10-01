<script
    lang="ts"
    generics="Row extends Record<string, unknown> | readonly (string | number | boolean | null | undefined)[] = Record<string, unknown> | readonly (string | number | boolean | null | undefined)[]"
>
    import type { Snippet } from "svelte";
    import { twMerge } from "tailwind-merge";

    type CellValue = string | number | boolean | null | undefined;
    type TableColumn = string | {
        key: string;
        label: string;
        class?: string;
        align?: "left" | "center" | "right";
    };
    type TableRow = Record<string, unknown> | readonly CellValue[];

    type Props = {
        columns?: TableColumn[];
        rows?: Row[];
        caption?: string;
        emptyText?: string;
        flush?: boolean;
        row?: Snippet<[row: Row, index: number]>;
        cell?: Snippet<[value: unknown, row: Row, column: Exclude<TableColumn, string>, rowIndex: number]>;
        children?: Snippet;
        showHeader?: boolean;
        headerRowClass?: string;
        rowClass?: string;
        cellClass?: string;
        class?: string;
    };

    let {
        columns = [],
        rows = [],
        caption,
        emptyText = "Aucune donnée",
        flush = true,
        row,
        cell,
        children,
        showHeader = true,
        headerRowClass = "",
        rowClass = "",
        cellClass = "",
        class: className = "",
    }: Props = $props();

    const normalizedColumns = $derived(columns.map((column) => {
        if (typeof column === "string") {
            return { key: column, label: column };
        }

        return column;
    }));

    function getCell(row: TableRow, key: string, index: number): unknown {
        if (Array.isArray(row)) {
            return row[index];
        }

        return (row as Record<string, unknown>)[key];
    }

    function getAlignClass(align?: "left" | "center" | "right") {
        if (align === "center") return "text-center";
        if (align === "right") return "text-right";
        return "text-left";
    }
</script>

<div
    class={twMerge(
        "settings-table overflow-hidden border-(--light-bg3) bg-(--light-bg1)",
        flush ? "-mx-4 w-[calc(100%+2rem)]" : "rounded-lg border",
        className,
    )}
>
    <table class="w-full border-collapse text-xs">
        {#if caption}
            <caption class="px-4 py-2 text-left font-medium text-(--grey)">{caption}</caption>
        {/if}

        {#if children}
            {@render children()}
        {:else}
            {#if showHeader && normalizedColumns.length}
                <thead>
                    <tr class={twMerge("border-b border-(--light-bg3) bg-(--light-bg2)", headerRowClass)}>
                        {#each normalizedColumns as column}
                            <th class={twMerge("px-4 py-2 font-semibold text-(--dark-bg1)", getAlignClass(column.align), column.class)}>
                                {column.label}
                            </th>
                        {/each}
                    </tr>
                </thead>
            {/if}

            <tbody>
                {#each rows as item, index}
                    {#if row}
                        {@render row(item, index)}
                    {:else}
                        <tr class={twMerge("data-table-row border-b border-(--light-bg3) last:border-b-0", rowClass)}>
                            {#each normalizedColumns as column, columnIndex}
                                <td class={twMerge("px-4 py-2 text-(--dark-bg1)", getAlignClass(column.align), column.class, cellClass)}>
                                    {#if cell}
                                        {@render cell(getCell(item, column.key, columnIndex), item, column, index)}
                                    {:else}
                                        {getCell(item, column.key, columnIndex) ?? "-"}
                                    {/if}
                                </td>
                            {/each}
                        </tr>
                    {/if}
                {:else}
                    <tr>
                        <td class="px-4 py-3 text-center text-(--grey)" colspan={Math.max(normalizedColumns.length, 1)}>
                            {emptyText}
                        </td>
                    </tr>
                {/each}
            </tbody>
        {/if}
    </table>
</div>
