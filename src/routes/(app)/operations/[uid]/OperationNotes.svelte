<script lang="ts">
    import { onMount, tick } from "svelte";
    import { apiGet, apiPatch, apiPost } from "$lib/api";
    import { Button, Checkbox, Textarea } from "$lib/components/istyler";
    import { currentUser } from "$lib/auth";
    import NoteMarkup from "$lib/components/notes/NoteMarkup.svelte";
    import UserAvatar from "$lib/components/UserAvatar.svelte";
    import { strftime } from "$lib/utils";
    import * as Icon from "lucide-svelte";
    import { toast } from "svelte-sonner";

    type OperationNote = {
        id: number;
        operation: number;
        data: string;
        created_at: string;
        creator?: Record<string, any>;
        tracking_public?: boolean;
    };

    let {
        operationId,
        active = false,
        markdownEnabled = true,
        trackingEnabled = false,
        onLoaded,
        onCountChange,
        onChanged,
    } = $props<{
        operationId: number | null;
        active?: boolean;
        markdownEnabled?: boolean;
        trackingEnabled?: boolean;
        onLoaded?: (notes: OperationNote[]) => void;
        onCountChange?: (count: number) => void;
        onChanged?: () => void;
    }>();

    const PAGE_SIZE = 20;
    const LOAD_THRESHOLD = 48;

    let notes: OperationNote[] = $state([]);
    let totalCount = $state(0);
    let hasOlder = $state(false);
    let draft = $state("");
    let publishDraft = $state(false);
    let updatingPublication = $state<number | null>(null);
    let loading = $state(false);
    let loadingOlder = $state(false);
    let saving = $state(false);
    let error: string | null = $state(null);
    let viewport = $state<HTMLDivElement | null>(null);
    let needsInitialScroll = $state(false);
    let loadGeneration = 0;
    const canPublish = $derived(Boolean($currentUser?.administrator || $currentUser?.permissions?.includes("tracking.publish")));

    const creatorName = (creator?: Record<string, any>) =>
        creator?.username || [creator?.name, creator?.lastname].filter(Boolean).join(" ") || "Utilisateur";

    const noteQuery = (currentOperationId: number, offset = 0) =>
        new URLSearchParams({
            operation: String(currentOperationId),
            limit: String(PAGE_SIZE),
            offset: String(offset),
        }).toString();

    const responseNotes = (response: any) =>
        (Array.isArray(response) ? response : response?.results ?? []) as OperationNote[];

    const notifyLoaded = () => {
        onLoaded?.(notes);
        onCountChange?.(totalCount);
    };

    const scrollToLatest = () => {
        if (!viewport || viewport.clientHeight === 0) return;
        viewport.scrollTop = viewport.scrollHeight;
        needsInitialScroll = false;
    };

    export async function refresh() {
        const currentOperationId = operationId;
        const generation = ++loadGeneration;
        if (!currentOperationId) {
            notes = [];
            totalCount = 0;
            hasOlder = false;
            notifyLoaded();
            return;
        }

        loading = true;
        loadingOlder = false;
        error = null;
        let loaded = false;
        try {
            const response = await apiGet(`/core/notes/?${noteQuery(currentOperationId)}`);
            if (generation !== loadGeneration || operationId !== currentOperationId) return;

            const page = responseNotes(response);
            notes = [...new Map([...page].reverse().map((note) => [note.id, note])).values()];
            totalCount = Number(response?.count) || notes.length;
            hasOlder = notes.length < totalCount;
            needsInitialScroll = true;
            notifyLoaded();
            loaded = true;
        } catch (e) {
            if (generation !== loadGeneration) return;
            console.error("Failed to load notes", e);
            error = "Impossible de charger les notes.";
        } finally {
            if (generation === loadGeneration) loading = false;
        }

        if (loaded) {
            await tick();
            if (generation === loadGeneration) scrollToLatest();
        }
    }

    const loadOlder = async () => {
        const currentOperationId = operationId;
        const generation = loadGeneration;
        if (!currentOperationId || loading || loadingOlder || !hasOlder) return;

        loadingOlder = true;
        try {
            const response = await apiGet(`/core/notes/?${noteQuery(currentOperationId, notes.length)}`);
            if (generation !== loadGeneration || operationId !== currentOperationId) return;

            const previousHeight = viewport?.scrollHeight ?? 0;
            const previousTop = viewport?.scrollTop ?? 0;
            const page = responseNotes(response);
            const knownIds = new Set(notes.map((note) => note.id));
            const olderNotes = [...page]
                .reverse()
                .filter((note) => !knownIds.has(note.id));

            totalCount = Number(response?.count) || totalCount;
            notes = [...olderNotes, ...notes];
            hasOlder = notes.length < totalCount && page.length > 0;
            notifyLoaded();
            loadingOlder = false;

            await tick();
            if (generation === loadGeneration && viewport) {
                viewport.scrollTop = previousTop + viewport.scrollHeight - previousHeight;
            }
        } catch (e) {
            if (generation !== loadGeneration) return;
            console.error("Failed to load older notes", e);
            toast.error("Impossible de charger les notes précédentes.");
        } finally {
            if (generation === loadGeneration) loadingOlder = false;
        }
    };

    const handleScroll = () => {
        if (viewport && viewport.scrollTop <= LOAD_THRESHOLD) void loadOlder();
    };

    const addNote = async () => {
        const text = draft.trim();
        if (!operationId || !text || saving) return;
        const currentOperationId = operationId;
        const generation = loadGeneration;
        saving = true;
        error = null;
        try {
            const created = await apiPost("/core/notes/", {
                operation: currentOperationId,
                data: text,
                ...(canPublish && trackingEnabled ? { tracking_public: publishDraft } : {}),
            }) as OperationNote;
            if (generation !== loadGeneration || operationId !== currentOperationId) return;
            draft = "";
            publishDraft = false;
            if (created?.id) {
                notes = [...notes.filter((note) => note.id !== created.id), created];
                totalCount += 1;
                hasOlder = notes.length < totalCount;
                notifyLoaded();
                await tick();
                scrollToLatest();
            } else {
                await refresh();
            }
            onChanged?.();
        } catch (e) {
            console.error("Failed to add note", e);
            error = "Impossible d'ajouter la note.";
        } finally {
            saving = false;
        }
    };

    const changePublication = async (note: OperationNote) => {
        if (!canPublish || updatingPublication !== null) return;
        const currentOperationId = operationId;
        const generation = loadGeneration;
        updatingPublication = note.id;
        try {
            const updated = await apiPatch(`/core/notes/${note.id}/`, { tracking_public: !note.tracking_public }) as OperationNote;
            if (generation !== loadGeneration || operationId !== currentOperationId) return;
            notes = notes.map((item) => item.id === updated.id ? updated : item);
            notifyLoaded();
            onChanged?.();
        } catch {
            toast.error("Impossible de modifier la publication de cette note.");
        } finally {
            if (generation === loadGeneration) updatingPublication = null;
        }
    };

    const onKeydown = (event: KeyboardEvent) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void addNote();
        }
    };

    $effect(() => {
        if (!active || !needsInitialScroll || !notes.length) return;
        void tick().then(() => {
            if (active && needsInitialScroll) scrollToLatest();
        });
    });

    onMount(() => {
        void refresh();
        return () => {
            loadGeneration += 1;
        };
    });
</script>

<div class="flex h-full flex-col">
    <div
        bind:this={viewport}
        class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        onscroll={handleScroll}
    >
        {#if loading}
            <div class="flex flex-col items-center justify-center gap-3 py-16 text-center text-xs text-(--grey)">
                <Icon.Loader2 size={18} class="ui-loader-spin" />
                Chargement...
            </div>
        {:else if error}
            <div class="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <Icon.AlertCircle size={22} class="text-(--red)" />
                <div class="text-sm font-semibold">{error}</div>
                <Button
                    variant="secondary"
                    size="sm"
                    icon="RefreshCw"
                    label="Réessayer"
                    class="w-fit"
                    onclick={refresh}
                />
            </div>
        {:else if !notes.length}
            <div class="flex min-h-72 flex-col items-center justify-center gap-3 px-8 text-center">
                <div class="flex size-10 items-center justify-center rounded-xl border border-(--light-bg3) bg-(--light-bg2) text-(--grey)">
                    <Icon.MessageSquare size={18} />
                </div>
                <div>
                    <p class="text-sm font-semibold text-(--dark-bg1)">Aucune note</p>
                    <p class="mt-1 max-w-52 text-xs leading-5 text-(--grey)">Les notes internes de l'équipe apparaîtront ici.</p>
                </div>
            </div>
        {:else}
            <div class="flex flex-col">
                {#if loadingOlder}
                    <div class="flex h-9 shrink-0 items-center justify-center gap-2 text-xs text-(--grey)" role="status">
                        <Icon.Loader2 size={14} class="ui-loader-spin" />
                        Chargement des notes précédentes...
                    </div>
                {/if}
                {#each notes as note, index (note.id)}
                    {@const name = creatorName(note.creator)}
                    <div class="flex gap-2.5 p-2 {index < notes.length - 1 ? 'border-b border-(--light-bg3)' : ''} hover:bg-(--light-bg2) transition-(--transition)">
                        <UserAvatar user={note.creator} class="size-7 text-xs" />
                        <div class="min-w-0 flex-1">
                            <div class="mb-1 truncate text-xs font-normal text-(--grey) space-x-1">
                                <span class="text-(--dark-bg1) font-semibold">{name}</span>{" "}
                                <span>
                                    {`${strftime(note.created_at, "%d %B %Y", "fr-FR").toLowerCase()} · ${strftime(note.created_at, "%Hh%M", "fr-FR")}`}
                                </span>
                                {#if note.tracking_public}
                                    <span class="inline-flex items-center gap-1 text-(--blue)"><Icon.Globe size={11} /> Publique</span>
                                {/if}
                            </div>
                            <div class="whitespace-pre-wrap text-xs leading-5 text-(--dark-bg1)">
                                {#if markdownEnabled}
                                    <NoteMarkup text={note.data} />
                                {:else}
                                    {note.data}
                                {/if}
                            </div>
                        </div>
                        {#if canPublish && (trackingEnabled || note.tracking_public)}
                            <Button
                                variant="ghost"
                                size="xs"
                                icon={updatingPublication === note.id ? "Loader2" : note.tracking_public ? "EyeOff" : "Globe"}
                                iconAnimation={updatingPublication === note.id ? "spin" : undefined}
                                tooltip={note.tracking_public ? "Retirer du suivi client" : "Publier dans le suivi client"}
                                aria-label={note.tracking_public ? "Retirer du suivi client" : "Publier dans le suivi client"}
                                class="size-7 shrink-0 px-0"
                                disabled={updatingPublication !== null}
                                confirm={!note.tracking_public}
                                confirmTitle="Publier cette note ?"
                                confirmDescription="Son contenu sera transmis au site externe et accessible au client."
                                confirmCancelLabel="Annuler"
                                confirmConfirmLabel="Publier"
                                onclick={() => changePublication(note)}
                            />
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}
    </div>

    <div class="shrink-0 border-t border-(--light-bg3) px-3 py-2.5">
        {#if canPublish && trackingEnabled}
            <div class="mb-2">
                <Checkbox label="Publier dans le suivi client" bind:value={publishDraft} disabled={saving} switchMode side="left" />
                {#if publishDraft}
                    <p class="mt-1 text-xs leading-4 text-(--orange)">Cette note sera transmise au site externe et accessible au client.</p>
                {/if}
            </div>
        {/if}
        <div class="flex items-end gap-2">
            <div class="min-w-0 flex-1">
                <Textarea
                    placeholder="Ajouter une note..."
                    ariaLabel="Ajouter une note"
                    bind:value={draft}
                    onkeydown={onKeydown}
                    maxlength={1000}
                    disabled={saving}
                    resize="none"
                    autoGrow
                    rows={1}
                    parentClass="min-h-10 max-h-30 [&>textarea]:min-h-[22px]! [&>textarea]:max-h-[102px]!"
                />
            </div>
            <Button
                class="size-10 shrink-0 px-0"
                aria-label="Ajouter une note"
                icon={saving ? "Loader2" : "Send"}
                iconAnimation={saving ? "spin" : undefined}
                disabled={!draft.trim() || saving}
                onclick={addNote}
            />
        </div>
        <div class="mt-1.5 flex items-center justify-between gap-3 text-xs text-(--grey)">
            <span>↵ Envoyer · ⇧↵ Nouvelle ligne</span>
            <span>{draft.length}/1000</span>
        </div>
    </div>
</div>
