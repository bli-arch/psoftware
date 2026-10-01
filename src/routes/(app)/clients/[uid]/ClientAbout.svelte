<script lang="ts">
    import LucideIcon from "$lib/components/Badge/LucideIcon.svelte";
    import { operationPlural } from "$lib/operationDisplay";
    import { appSettings } from "$lib/settings";
    import { strftime } from "$lib/utils";
    import { getFieldConfig, getUserLabel } from "../../operations/operationUtils";
    import * as Icon from "lucide-svelte";
    import ClientPrivacyActions from "./ClientPrivacyActions.svelte";

    let {
        client,
        pagesData = [],
        operationCount = 0,
        canExport = false,
        canDelete = false,
    } = $props<{
        client: Record<string, any>;
        pagesData?: any[];
        operationCount?: number;
        canExport?: boolean;
        canDelete?: boolean;
    }>();

    const hasValue = (value: any): boolean => {
        if (value === null || value === undefined) return false;
        if (typeof value === "string") return value.trim().length > 0;
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === "object") return Object.values(value).some(hasValue);
        return true;
    };

    const countFields = () => {
        let total = 0;
        let filled = 0;

        pagesData.forEach((page: any) => {
            (page.formFields ?? page.items ?? []).forEach((field: any) => {
                const config = getFieldConfig(field);
                if (!config.name) return;
                total += 1;
                if (hasValue(client?.data?.[config.name])) filled += 1;
            });
        });

        return { total, filled };
    };

    const fieldStats = $derived(countFields());
</script>

<div class="flex h-full flex-col">
    <div class="min-h-0 flex-1 overflow-y-auto">
        <div class="space-y-4">
            <section>
                <div class="flex divide-x divide-(--light-bg3) border-b border-(--light-bg3)">
                    <div class="w-full bg-(--light-bg1) px-4 py-3">
                        <div class="flex items-start justify-between gap-4">
                            <span class="min-w-0">
                                <strong class="block text-2xl leading-none tabular-nums">{fieldStats.filled}/{fieldStats.total}</strong>
                                <span class="mt-1.5 block truncate text-sm font-semibold">Champs</span>
                            </span>
                            <Icon.ListChecks size={17} class="mt-0.5 shrink-0 text-(--grey)" />
                        </div>
                        <div class="mt-3 text-xs text-(--grey)">Renseignés</div>
                    </div>

                    <div class="w-full bg-(--light-bg1) px-4 py-3">
                        <div class="flex items-start justify-between gap-4">
                            <span class="min-w-0">
                                <strong class="block text-2xl leading-none tabular-nums">{operationCount}</strong>
                                <span class="mt-1.5 block truncate text-sm font-semibold">
                                    {operationPlural($appSettings.value.operation)}
                                </span>
                            </span>
                            <LucideIcon
                                name={($appSettings.value.operation.operationIcon || "BriefcaseBusiness") as any}
                                size={17}
                                class="mt-0.5 shrink-0 text-(--grey)"
                            />
                        </div>
                        <div class="mt-3 text-xs text-(--grey)">Pour ce client</div>
                    </div>
                </div>
            </section>

            <section class="px-4">
                <div class="mb-3 text-xs font-semibold uppercase tracking-widest text-(--grey)">Informations</div>
                <dl class="space-y-3 text-xs">
                    <div class="flex items-start justify-between gap-3">
                        <dt class="text-(--grey)">Identifiant</dt>
                        <dd class="min-w-0 break-all text-right font-semibold">#{client.uid}</dd>
                    </div>
                    <div class="flex items-start justify-between gap-3">
                        <dt class="text-(--grey)">Créée le</dt>
                        <dd class="text-right font-semibold">{strftime(new Date(client.created_at), "%d %B %Y à %Hh%M", "fr-FR")}</dd>
                    </div>
                    <div class="flex items-start justify-between gap-3">
                        <dt class="text-(--grey)">Créée par</dt>
                        <dd class="min-w-0 truncate text-right font-semibold">{getUserLabel(client.creator)}</dd>
                    </div>
                </dl>
            </section>

            <section class="px-4">
                <ClientPrivacyActions uid={client.uid} {canExport} {canDelete} />
            </section>
        </div>
    </div>
</div>
