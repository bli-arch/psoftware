<script lang="ts">
    import { Accordion } from "bits-ui";
    import { slide } from "svelte/transition";
    import { apiDelete, apiGet } from "$lib/api";
    import { currentUser } from "$lib/auth";
    import { animationTime } from "$lib/uiPreferences";
    import { strftime } from "$lib/utils";
    import { StateBadge } from "$lib/components/Badge";
    import { Button } from "$lib/components/istyler";
    import * as Icon from "lucide-svelte";
    import NoteMarkup from "$lib/components/notes/NoteMarkup.svelte";
    import UserAvatar from "$lib/components/UserAvatar.svelte";
    import { toast } from "svelte-sonner";
    import {
        sanitizeActivityChanges,
        type ActivityFieldChange as FieldChange,
        type ActivityPrivacyMap,
    } from "./activityPrivacy";

    type ActivityType = "modification" | "status" | "note";
    type Line =
        | { key: string; kind: "text"; label: string; from?: string; to?: string }
        | { key: string; kind: "state"; from: unknown; to: unknown }
        | { key: string; kind: "note"; text: string };
    type ActivityItem = {
        id: number;
        changes: Record<string, any>;
        created_at: string;
        performed_by?: Record<string, any>;
    };
    type ViewItem = { id: number; type: ActivityType; user: Record<string, any>; action: string; time: string; lines: Line[] };
    type DayGroup = { key: string; label: string; items: ViewItem[] };

    let {
        entityId,
        endpoint,
        queryParam,
        states = [],
        order = "desc",
        createdAction,
        modifiedAction,
        emptyText,
        onLoaded,
        privacy = {},
        privacyReady = true,
    } = $props<{
        entityId: number | null;
        endpoint: string;
        queryParam: string;
        states?: Array<Record<string, any>>;
        order?: "asc" | "desc";
        createdAction: string;
        modifiedAction: string;
        emptyText: string;
        onLoaded?: (activities: ActivityItem[]) => void;
        privacy?: ActivityPrivacyMap;
        privacyReady?: boolean;
    }>();

    let activities: ActivityItem[] = $state([]);
    let loading = $state(false);
    let error: string | null = $state(null);
    let openDates: string[] = $state([]);
    let deletingId: number | null = $state(null);

    const humanize = (value: string) =>
        value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().replace(/^\w/, (char) => char.toUpperCase());

    const stringify = (value: unknown): string => {
        if (value === null || value === undefined || value === "") return "Non renseigné";
        if (typeof value === "boolean") return value ? "Oui" : "Non";
        if (typeof value === "number" || typeof value === "bigint" || typeof value === "string") return String(value);
        if (Array.isArray(value)) {
            if (value.every((entry) => entry === null || ["string", "number", "boolean"].includes(typeof entry))) {
                return value.map(stringify).join(", ");
            }
            return value.map((entry, index) => `${index + 1}. ${stringify(entry)}`).join("\n");
        }
        if (typeof value === "object") {
            return Object.entries(value as Record<string, unknown>)
                .filter(([, nested]) => nested !== null && nested !== undefined && nested !== "")
                .slice(0, 5)
                .map(([key, nested]) => `${humanize(key)}: ${stringify(nested)}`)
                .join(" | ") || "Objet vide";
        }
        return String(value);
    };

    const stable = (value: any): string => {
        if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
        if (value && typeof value === "object") {
            return `{${Object.keys(value).sort().map((key) => `${key}:${stable(value[key])}`).join(",")}}`;
        }
        return JSON.stringify(value);
    };

    const userName = (user?: Record<string, any>) =>
        user?.username || [user?.name, user?.lastname].filter(Boolean).join(" ") || "Système";
    const isStateChange = (changes: Record<string, any>) =>
        changes?.type === "state_changed" || changes?.type === "status" || changes?.type === "status_changed";
    const isNote = (changes: Record<string, any>) => changes?.type === "note" || changes?.type === "note_added";
    const resolveFields = (changes: Record<string, any>): FieldChange[] => Array.isArray(changes?.fields) ? changes.fields : [];

    const summarizeArray = (field: FieldChange, baseKey: string): Line[] | null => {
        if (!Array.isArray(field.from) || !Array.isArray(field.to)) return null;
        const lines: Line[] = [];
        const max = Math.max(field.from.length, field.to.length);

        for (let index = 0; index < max; index += 1) {
            const previous = field.from[index];
            const next = field.to[index];
            if (stable(previous) === stable(next)) continue;

            const label = `${field.label ?? field.name ?? "Champ"} ${index + 1}`;
            if (previous === undefined) lines.push({ key: `${baseKey}-add-${index}`, kind: "text", label, to: stringify(next) });
            else if (next === undefined) lines.push({ key: `${baseKey}-remove-${index}`, kind: "text", label, from: stringify(previous) });
            else lines.push({ key: `${baseKey}-update-${index}`, kind: "text", label, from: stringify(previous), to: stringify(next) });
        }

        return lines.length ? lines : null;
    };

    const buildLines = (activity: ActivityItem): Line[] => {
        const changes = sanitizeActivityChanges(activity.changes ?? {}, privacy);
        if (isStateChange(changes)) {
            const fields = resolveFields(changes);
            return fields.length
                ? fields.map((field, index) => ({ key: `state-${activity.id}-${index}`, kind: "state", from: field.from, to: field.to }))
                : [{ key: `state-${activity.id}`, kind: "state", from: changes.from, to: changes.to }];
        }
        if (isNote(changes)) {
            return [{ key: `note-${activity.id}`, kind: "note", text: String(changes.note ?? changes.text ?? changes.summary ?? "Note ajoutée") }];
        }

        const fields = resolveFields(changes);
        if (!fields.length && changes.summary) return [{ key: `summary-${activity.id}`, kind: "text", label: changes.summary }];

        return fields.flatMap((field, index) => {
            const baseKey = `field-${activity.id}-${index}`;
            return summarizeArray(field, baseKey) ?? [{
                key: baseKey,
                kind: "text",
                label: field.label ?? field.name ?? "Champ",
                from: stringify(field.from),
                to: stringify(field.to),
            }];
        });
    };

    const buildItem = (activity: ActivityItem): ViewItem => {
        const changes = sanitizeActivityChanges(activity.changes ?? {}, privacy);
        const type: ActivityType = isStateChange(changes) ? "status" : isNote(changes) ? "note" : "modification";

        return {
            id: activity.id,
            type,
            user: activity.performed_by ?? {},
            action: type === "status"
                ? "a changé le statut"
                : type === "note"
                    ? "a ajouté une note"
                    : changes.type === "created"
                        ? createdAction
                        : modifiedAction,
            time: strftime(new Date(activity.created_at), "%Hh%M"),
            lines: buildLines(activity),
        };
    };

    const sortedActivities = $derived(
        [...activities].sort((a, b) =>
            order === "desc" ? b.created_at.localeCompare(a.created_at) : a.created_at.localeCompare(b.created_at)
        )
    );

    const dayGroups = $derived.by((): DayGroup[] => {
        const map = new Map<string, DayGroup>();
        for (const activity of sortedActivities) {
            const date = new Date(activity.created_at);
            const key = strftime(date, "%Y-%m-%d");
            if (!map.has(key)) map.set(key, { key, label: strftime(date, "%A %d %B %Y", "fr-FR"), items: [] });
            map.get(key)!.items.push(buildItem(activity));
        }
        return Array.from(map.values());
    });

    export async function refresh() {
        if (!entityId || !privacyReady) return;
        loading = true;
        error = null;
        try {
            const res = await apiGet(`${endpoint}/?${queryParam}=${encodeURIComponent(String(entityId))}`);
            const data = ((Array.isArray(res) ? res : res?.results ?? []) as ActivityItem[]).map((activity) => ({
                ...activity,
                changes: sanitizeActivityChanges(activity.changes ?? {}, privacy),
            }));
            activities = data;
            openDates = Array.from(new Set(
                [...data]
                    .sort((a, b) => order === "desc" ? b.created_at.localeCompare(a.created_at) : a.created_at.localeCompare(b.created_at))
                    .map((activity) => strftime(new Date(activity.created_at), "%Y-%m-%d"))
            ));
            onLoaded?.(data);
        } catch (e) {
            console.error("Failed to load activities", e);
            error = "Impossible de charger l'activité.";
        } finally {
            loading = false;
        }
    }

    const deleteActivity = async (id: number) => {
        if (!$currentUser?.administrator || deletingId !== null) return;
        deletingId = id;
        try {
            await apiDelete(`${endpoint}/${id}/`);
            await refresh();
            toast.success("Activité supprimée.");
        } catch (e) {
            console.error("Failed to delete activity", e);
            toast.error("Impossible de supprimer cette activité.");
        } finally {
            deletingId = null;
        }
    };

    $effect(() => {
        if (privacyReady && entityId) void refresh();
    });
</script>

<div class="flex h-full flex-col">
    <div class="min-h-0 flex-1 overflow-y-auto">
        {#if loading}
            <div class="flex flex-col items-center justify-center gap-3 py-20 text-center text-xs text-(--grey)">
                <Icon.Loader2 size={18} class="ui-loader-spin" />
                Chargement...
            </div>
        {:else if error}
            <div class="flex flex-col items-center justify-center gap-3 px-8 py-20 text-center">
                <Icon.AlertCircle size={22} class="text-(--red)" />
                <div class="text-sm font-semibold">{error}</div>
                <Button variant="ghost" size="xs" label="Réessayer" class="w-fit text-(--user-color)" onclick={refresh} />
            </div>
        {:else if !dayGroups.length}
            <div class="flex min-h-72 flex-col items-center justify-center gap-3 px-8 text-center">
                <div class="flex size-10 items-center justify-center rounded-xl border border-(--light-bg3) bg-(--light-bg2) text-(--grey)">
                    <Icon.Activity size={18} />
                </div>
                <div>
                    <p class="text-sm font-semibold text-(--dark-bg1)">Aucune activité</p>
                    <p class="mt-1 text-xs leading-5 text-(--grey)">{emptyText}</p>
                </div>
            </div>
        {:else}
            <Accordion.Root type="multiple" bind:value={openDates} class="px-4 pb-8 pt-2">
                {#each dayGroups as group (group.key)}
                    <Accordion.Item value={group.key} class="border-0">
                        <Accordion.Header>
                            <Accordion.Trigger class="group flex w-full cursor-pointer items-center gap-3 py-2 text-left focus:outline-none">
                                <span class="text-xs font-semibold uppercase tracking-widest text-(--grey) tabular-nums">{group.label}</span>
                                <span class="h-px flex-1 bg-(--light-bg3)"></span>
                                <Icon.ChevronDown size={14} class="ml-auto text-(--grey) transition-transform duration-(--animation-duration) group-data-[state=open]:rotate-180" />
                            </Accordion.Trigger>
                        </Accordion.Header>

                        <Accordion.Content forceMount>
                            {#snippet child({ props, open })}
                                {#if open}
                                    <div {...props} transition:slide={{ duration: animationTime() }}>
                                        {#each group.items as item, index (item.id)}
                                            {@const isLast = index === group.items.length - 1}
                                            <div class="flex gap-3">
                                                <div class="flex w-7 shrink-0 flex-col items-center">
                                                    <div class="h-1.5 w-px bg-(--light-bg3)"></div>
                                                    <UserAvatar user={item.user} class="size-7 text-[9px]" />
                                                    {#if !isLast}
                                                        <div class="min-h-3 flex-1 w-px bg-(--light-bg3)"></div>
                                                    {/if}
                                                </div>

                                                <div class="min-w-0 flex-1 py-2">
                                                    <div class="mt-0.5 flex items-start justify-between gap-2">
                                                        <div class="min-w-0 text-xs">
                                                            <span class="font-medium text-(--dark-bg1)">{userName(item.user)}</span>
                                                            <span class="ml-1 text-(--grey)">{item.action}</span>
                                                        </div>
                                                        <div class="flex shrink-0 items-center gap-1">
                                                            <span class="text-xs tabular-nums text-(--grey)">{item.time}</span>
                                                            {#if $currentUser?.administrator}
                                                                <Button
                                                                    variant="ghost"
                                                                    size="xs"
                                                                    icon={deletingId === item.id ? "Loader2" : "Trash2"}
                                                                    iconAnimation={deletingId === item.id ? "spin" : undefined}
                                                                    tooltip="Supprimer cette activité"
                                                                    class="w-fit text-(--red)"
                                                                    disabled={deletingId !== null}
                                                                    confirm
                                                                    confirmTitle="Supprimer cette activité ?"
                                                                    confirmDescription="Cette entrée sera définitivement supprimée de l'historique."
                                                                    confirmCancelLabel="Annuler"
                                                                    confirmConfirmLabel="Supprimer"
                                                                    confirmConfirmVariant="error"
                                                                    onclick={() => void deleteActivity(item.id)}
                                                                />
                                                            {/if}
                                                        </div>
                                                    </div>

                                                    {#if item.lines.length}
                                                        <div class="mt-2 flex flex-col gap-1.5">
                                                            {#each item.lines as line (line.key)}
                                                                {#if line.kind === "state"}
                                                                    <div class="flex items-center gap-2">
                                                                        <StateBadge state={line.from as any} {states} class="px-2 py-0.5 text-xs font-medium" />
                                                                        <Icon.ArrowRight size={12} class="shrink-0 text-(--grey)" />
                                                                        <StateBadge state={line.to as any} {states} class="px-2 py-0.5 text-xs font-medium" />
                                                                    </div>
                                                                {:else if line.kind === "note"}
                                                                    <div class="whitespace-pre-wrap text-xs leading-5 text-(--dark-bg1)">
                                                                        <NoteMarkup text={line.text} />
                                                                    </div>
                                                                {:else}
                                                                    <div>
                                                                        <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-(--grey)">{line.label}</div>
                                                                        {#if line.from !== undefined || line.to !== undefined}
                                                                            <div class="flex min-w-0 items-center gap-1.5 text-xs text-(--dark-bg1)">
                                                                                {#if line.from !== undefined}
                                                                                    <span class="min-w-0 truncate rounded bg-(--light-bg2) px-2 py-0.5 text-(--grey)">{line.from}</span>
                                                                                    <Icon.ArrowRight size={11} class="shrink-0 text-(--grey)" />
                                                                                {/if}
                                                                                {#if line.to !== undefined}
                                                                                    <span class="min-w-0 truncate rounded bg-(--user-color)/10 px-2 py-0.5 text-(--user-color)">{line.to}</span>
                                                                                {/if}
                                                                            </div>
                                                                        {/if}
                                                                    </div>
                                                                {/if}
                                                            {/each}
                                                        </div>
                                                    {/if}
                                                </div>
                                            </div>
                                        {/each}
                                    </div>
                                {/if}
                            {/snippet}
                        </Accordion.Content>
                    </Accordion.Item>
                {/each}
            </Accordion.Root>
        {/if}
    </div>
</div>
