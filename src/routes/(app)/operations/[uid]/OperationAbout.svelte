<script lang="ts">
    import { strftime } from "$lib/utils";
    import { StateBadge } from "$lib/components/Badge";
    import * as Icon from "lucide-svelte";

    let {
        operation,
        pagesData = [],
        states = [],
        activities = [],
        noteCount = 0,
    } = $props<{
        operation: Record<string, any>;
        pagesData?: any[];
        states?: Array<Record<string, any>>;
        activities?: any[];
        noteCount?: number;
    }>();

    const hasValue = (value: any): boolean => {
        if (value === null || value === undefined) return false;
        if (typeof value === "string") return value.trim().length > 0;
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === "object") return Object.values(value).some(hasValue);
        return true;
    };

    const fieldConfig = (field: any) => field?.config ?? field?.props ?? field ?? {};

    const sourceFor = (pageType?: string) =>
        pageType === "client" ? operation?.client?.data ?? {} : operation?.data ?? {};

    const countFields = () => {
        let total = 0;
        let filled = 0;

        pagesData.forEach((page: any) => {
            (page.formFields ?? page.items ?? []).forEach((field: any) => {
                const config = fieldConfig(field);
                if (!config.name) return;
                total += 1;
                if (hasValue(sourceFor(page.type)?.[config.name])) filled += 1;
            });
        });

        return { total, filled };
    };

    const creatorName = () => {
        const creator = operation?.creator;
        return creator?.username || [creator?.name, creator?.lastname].filter(Boolean).join(" ") || "Inconnu";
    };

    const currentStateIndex = $derived(states.findIndex((state: Record<string, any>) => String(state.id) === String(operation?.state)));
    const stateProgress = $derived(states.length ? Math.round(((Math.max(currentStateIndex, 0) + 1) / states.length) * 100) : 0);
    const fieldStats = $derived(countFields());
</script>

<div class="flex h-full flex-col">
    <div class="min-h-0 flex-1 overflow-y-auto">
        <div class="space-y-5">
            <section>
                <div class="flex flex-col divide-y divide-(--light-bg3) border-b border-(--light-bg3)">
                    <div class="w-full bg-(--light-bg1) px-4 py-3">
                        <div class="flex items-start justify-between gap-4">
                            <span class="min-w-0">
                                <strong class="block text-2xl leading-none tabular-nums">{stateProgress}%</strong>
                                <span class="mt-1.5 block truncate text-sm font-semibold">Avancement</span>
                            </span>
                            <StateBadge state={operation.state} {states} class="text-xs px-2.5 py-1 font-medium" />
                        </div>
                        <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-(--light-bg3)">
                            <div class="h-full rounded-full bg-(--user-color)" style="width: {stateProgress}%"></div>
                        </div>
                        <div class="mt-2 text-xs text-(--grey)">
                            {states.length ? `${Math.max(currentStateIndex, 0) + 1}/${states.length} statut${states.length > 1 ? "s" : ""}` : "Aucun statut configuré"}
                        </div>
                    </div>

                    <div class="w-full bg-(--light-bg1) px-4 py-3">
                        <div class="flex items-start justify-between gap-4">
                            <span class="min-w-0">
                                <strong class="block text-2xl leading-none tabular-nums">{fieldStats.filled}/{fieldStats.total}</strong>
                                <span class="mt-1.5 block truncate text-sm font-semibold">Champs</span>
                            </span>
                            <Icon.ListChecks size={17} class="mt-0.5 shrink-0 text-(--grey)" />
                        </div>
                        <div class="mt-3 text-xs text-(--grey)">
                            {fieldStats.filled} renseigné{fieldStats.filled === 1 ? "" : "s"} sur {fieldStats.total}
                        </div>
                    </div>

                    <div class="flex w-full divide-x divide-(--light-bg3)">
                        <div class="w-full bg-(--light-bg1) px-4 py-3">
                            <div class="flex items-start justify-between gap-3">
                                <span class="min-w-0">
                                    <strong class="block text-2xl leading-none tabular-nums">{activities.length}</strong>
                                    <span class="mt-1.5 block truncate text-sm font-semibold">Activité{activities.length > 1 ? "s" : ""}</span>
                                </span>
                                <Icon.Activity size={17} class="mt-0.5 shrink-0 text-(--grey)" />
                            </div>
                        </div>

                        <div class="w-full bg-(--light-bg1) px-4 py-3">
                            <div class="flex items-start justify-between gap-3">
                                <span class="min-w-0">
                                    <strong class="block text-2xl leading-none tabular-nums">{noteCount}</strong>
                                    <span class="mt-1.5 block truncate text-sm font-semibold">Note{noteCount > 1 ? "s" : ""}</span>
                                </span>
                                <Icon.MessageSquare size={17} class="mt-0.5 shrink-0 text-(--grey)" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section class="px-4">
                <div class="mb-3 text-xs font-semibold uppercase tracking-widest text-(--grey)">Informations</div>
                <dl class="space-y-3 text-xs">
                    <div class="flex items-start justify-between gap-3">
                        <dt class="text-(--grey)">Identifiant</dt>
                        <dd class="min-w-0 break-all text-right font-semibold">#{operation.uid}</dd>
                    </div>
                    {#if operation.client?.uid}
                        <div class="flex items-start justify-between gap-3">
                            <dt class="text-(--grey)">Client</dt>
                            <dd class="min-w-0 break-all text-right font-semibold">
                                <a
                                    href={`/clients/${encodeURIComponent(String(operation.client.uid))}`}
                                    class="text-(--blue) underline-offset-2 hover:underline"
                                >
                                    #{operation.client.uid}
                                </a>
                            </dd>
                        </div>
                    {/if}
                    <div class="flex items-start justify-between gap-3">
                        <dt class="text-(--grey)">Créée le</dt>
                        <dd class="text-right font-semibold">{strftime(new Date(operation.created_at), "%A %d %B %Y à %Hh%M", "fr-FR")}</dd>
                    </div>
                    <div class="flex items-start justify-between gap-3">
                        <dt class="text-(--grey)">Créée par</dt>
                        <dd class="min-w-0 truncate text-right font-semibold">{creatorName()}</dd>
                    </div>
                </dl>
            </section>
        </div>
    </div>
</div>
