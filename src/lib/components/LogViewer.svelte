<script lang="ts">
    import { onDestroy, tick, untrack } from "svelte";
    import { Dialog } from "bits-ui";
    import MyDialog from "$lib/components/MyDialog.svelte";
    import { Button, TextInput } from "$lib/components/istyler";
    import {
        buildServerLogLiveUrl,
        createServerLogLiveToken,
        getServerLogs,
        type ServerLogLevel,
        type ServerLogRow,
        type ServerLogsResponse,
    } from "$lib/adminServer";

    type ParsedLog = {
        level: string;
        date: string;
        ip: string;
        duration: string;
        user: string;
        method: string;
        content: string;
        status: string;
    };

    type HighlightSegment = {
        text: string;
        match: boolean;
    };

    let {
        title = "Journaux",
        description = "Consultez les événements serveur récents.",
        triggerLabel = "Ouvrir",
    }: {
        title?: string;
        description?: string;
        triggerLabel?: string;
    } = $props();

    const ROW_HEIGHT = 34;
    const OVERSCAN = 12;
    const INITIAL_LIMIT = 800;
    const LIVE_LIMIT = 250;
    const formattedLogPattern = /^\[(INFO|WARNING|ERROR)\]\s+(.+?)\s+(?:\[([^\]]+)\]|(\S+))\s+([0-9.]+ms)\s+(?:(\d+|-)\s+)?([A-Z]+)\s+(\S+)\s+(\d{3})$/;
    const levelLabels: Record<ServerLogLevel, string> = {
        all: "Tous",
        info: "Infos",
        warning: "Avertissements",
        error: "Erreurs",
    };

    let open = $state(false);
    let rows = $state<ServerLogRow[]>([]);
    let level = $state<ServerLogLevel>("all");
    let search = $state("");
    let loading = $state(false);
    let loadingOlder = $state(false);
    let error = $state("");
    let nextBefore = $state<number | null>(null);
    let latestOffset = $state<number | null>(null);
    let hasOlder = $state(false);
    let loadedOnce = $state(false);
    let liveEnabled = $state(false);
    let viewport = $state<HTMLDivElement | null>(null);
    let scrollTop = $state(0);
    let viewportHeight = $state(0);
    let liveSocket: WebSocket | null = null;
    let liveConnecting = $state(false);
    let liveConnectionId = 0;
    let liveConnectTimer: ReturnType<typeof setTimeout> | null = null;
    let filterTimer: ReturnType<typeof setTimeout> | null = null;
    let previousLevel: ServerLogLevel = "all";
    let previousSearch = "";

    const visibleStart = $derived(Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN));
    const visibleEnd = $derived(Math.min(rows.length, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN));
    const visibleRows = $derived(rows.slice(visibleStart, visibleEnd));
    const topPadding = $derived(visibleStart * ROW_HEIGHT);
    const bottomPadding = $derived(Math.max(0, (rows.length - visibleEnd) * ROW_HEIGHT));

    function rowLevelClass(rowLevel: ServerLogRow["level"]) {
        if (rowLevel === "error") return "text-(--red)";
        if (rowLevel === "warning") return "text-amber-600";
        return "text-blue-600";
    }

    function rowBackgroundClass(rowLevel: ServerLogRow["level"]) {
        if (rowLevel === "error") return "bg-(--transparent-red)";
        if (rowLevel === "warning") return "bg-(--orange)/10";
        return "bg-(--light-bg2)";
    }

    function statusClass(status: string | undefined) {
        const code = Number(status);
        if (!Number.isFinite(code)) return "text-(--grey)";
        if (code >= 500) return "text-(--red)";
        if (code >= 400) return "text-(--orange)";
        if (code >= 300) return "text-violet-600";
        if (code >= 200) return "text-(--green)";
        if (code >= 100) return "text-blue-600";
        return "text-(--grey)";
    }

    function parseLog(text: string): ParsedLog | null {
        const match = formattedLogPattern.exec(text);
        if (!match) return null;
        return {
            level: match[1],
            date: match[2],
            ip: match[3] ?? match[4],
            duration: match[5],
            user: match[6] ?? "-",
            method: match[7],
            content: match[8],
            status: match[9],
        };
    }

    function contentText(row: ServerLogRow, parsed: ParsedLog | null) {
        if (parsed) return parsed.content;
        return row.text.replace(new RegExp(`^\\[${row.level.toUpperCase()}\\]\\s+`), "");
    }

    function emptyLogMessage() {
        if (search.trim()) return "Aucun log ne correspond à cette recherche.";
        if (level === "info") return "Aucune information.";
        if (level === "warning") return "Aucun avertissement.";
        if (level === "error") return "Aucune erreur.";
        return "Aucun log disponible.";
    }

    function highlightSegments(text: string): HighlightSegment[] {
        const query = search.trim();
        if (!query) return [{ text, match: false }];

        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const segments: HighlightSegment[] = [];
        let cursor = 0;
        let index = lowerText.indexOf(lowerQuery);

        while (index !== -1) {
            if (index > cursor) segments.push({ text: text.slice(cursor, index), match: false });
            const end = index + query.length;
            segments.push({ text: text.slice(index, end), match: true });
            cursor = end;
            index = lowerText.indexOf(lowerQuery, cursor);
        }

        if (cursor < text.length) segments.push({ text: text.slice(cursor), match: false });
        return segments.length ? segments : [{ text, match: false }];
    }

    function mergeRows(currentRows: ServerLogRow[], nextRows: ServerLogRow[], position: "prepend" | "append") {
        const seen = new Set(currentRows.map((row) => row.id));
        const uniqueRows = nextRows.filter((row) => !seen.has(row.id));
        return position === "prepend"
            ? [...uniqueRows, ...currentRows]
            : [...currentRows, ...uniqueRows];
    }

    async function loadInitial() {
        loading = true;
        error = "";

        try {
            const response = await getServerLogs({ level, search, limit: INITIAL_LIMIT });
            rows = response.rows;
            nextBefore = response.nextBefore;
            latestOffset = response.latestOffset;
            hasOlder = response.hasOlder;
            loadedOnce = true;
            await tick();
            if (viewport) viewport.scrollTop = 0;
        } catch (loadError) {
            console.error("Failed to load logs", loadError);
            error = "Impossible de charger les logs.";
        } finally {
            loading = false;
        }
    }

    async function resetLogs() {
        const shouldRestartLive = liveEnabled;
        stopLive();
        rows = [];
        nextBefore = null;
        latestOffset = null;
        hasOlder = false;
        loadedOnce = false;
        await loadInitial();
        if (shouldRestartLive) void startLive();
    }

    async function loadOlder() {
        if (loading || loadingOlder || !hasOlder || nextBefore === null) return;
        loadingOlder = true;

        try {
            const response = await getServerLogs({
                level,
                search,
                before: nextBefore,
                limit: INITIAL_LIMIT,
            });
            rows = mergeRows(rows, response.rows, "append");
            nextBefore = response.nextBefore;
            hasOlder = response.hasOlder;
        } catch (loadError) {
            console.error("Failed to load older logs", loadError);
            error = "Impossible de charger les logs plus anciens.";
        } finally {
            loadingOlder = false;
        }
    }

    function applyLiveResponse(response: Pick<ServerLogsResponse, "rows" | "latestOffset">) {
        if (response.rows.length) rows = mergeRows(rows, response.rows, "prepend");
        latestOffset = response.latestOffset;
    }

    function stopLive() {
        liveConnectionId += 1;
        liveConnecting = false;
        if (liveConnectTimer) {
            clearTimeout(liveConnectTimer);
            liveConnectTimer = null;
        }
        if (!liveSocket) return;

        const socket = liveSocket;
        liveSocket = null;
        socket.onclose = null;
        socket.onerror = null;
        socket.onmessage = null;
        socket.close(1000, "closed");
    }

    async function startLive() {
        if (!open || !liveEnabled || liveConnecting || liveSocket || latestOffset === null) return;

        const connectionId = liveConnectionId + 1;
        liveConnectionId = connectionId;
        liveConnecting = true;
        error = "";

        try {
            const { token } = await createServerLogLiveToken();
            if (connectionId !== liveConnectionId || !open || !liveEnabled || latestOffset === null) return;

            const socket = new WebSocket(buildServerLogLiveUrl(token, {
                level,
                search,
                after: latestOffset,
                limit: LIVE_LIMIT,
            }));
            liveSocket = socket;
            liveConnectTimer = setTimeout(() => {
                if (connectionId !== liveConnectionId || socket.readyState === WebSocket.OPEN) return;
                liveConnectTimer = null;
                liveConnecting = false;
                liveEnabled = false;
                error = "Impossible d’activer le live.";
                socket.close();
            }, 10_000);

            socket.onopen = () => {
                if (connectionId !== liveConnectionId) return;
                if (liveConnectTimer) {
                    clearTimeout(liveConnectTimer);
                    liveConnectTimer = null;
                }
                liveConnecting = false;
            };

            socket.onmessage = (event) => {
                if (connectionId !== liveConnectionId || typeof event.data !== "string") return;
                try {
                    applyLiveResponse(JSON.parse(event.data) as Pick<ServerLogsResponse, "rows" | "latestOffset">);
                } catch (parseError) {
                    console.error("Invalid live log payload", parseError);
                }
            };

            socket.onerror = () => {
                if (connectionId !== liveConnectionId) return;
                if (liveConnectTimer) {
                    clearTimeout(liveConnectTimer);
                    liveConnectTimer = null;
                }
                liveConnecting = false;
                liveEnabled = false;
                error = "Impossible d’activer le live.";
            };

            socket.onclose = (event) => {
                if (connectionId !== liveConnectionId) return;
                if (liveConnectTimer) {
                    clearTimeout(liveConnectTimer);
                    liveConnectTimer = null;
                }
                liveSocket = null;
                liveConnecting = false;
                if (liveEnabled && event.code !== 1000) {
                    liveEnabled = false;
                    error = "Lecture live interrompue.";
                } else if (liveEnabled) {
                    void startLive();
                }
            };
        } catch (loadError) {
            if (connectionId !== liveConnectionId) return;
            console.error("Failed to start live logs", loadError);
            liveConnecting = false;
            liveEnabled = false;
            error = "Impossible d'activer le live.";
        }
    }

    function handleScroll() {
        if (!viewport) return;
        scrollTop = viewport.scrollTop;
        if (viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < ROW_HEIGHT * 8) {
            void loadOlder();
        }
    }

    function scheduleFilterReload() {
        if (!open || !loadedOnce) return;
        if (filterTimer) clearTimeout(filterTimer);
        filterTimer = setTimeout(() => void resetLogs(), 250);
    }

    $effect(() => {
        if (open) untrack(() => void resetLogs());
        else {
            liveEnabled = false;
            stopLive();
        }
    });

    $effect(() => {
        const canStartLive = open && liveEnabled && latestOffset !== null;
        if (canStartLive) untrack(() => void startLive());
        else stopLive();
    });

    $effect(() => {
        const nextLevel = level;
        const nextSearch = search;
        if (nextLevel === previousLevel && nextSearch === previousSearch) return;

        previousLevel = nextLevel;
        previousSearch = nextSearch;
        scheduleFilterReload();
    });

    $effect(() => {
        const node = viewport;
        if (!node) {
            viewportHeight = 0;
            return;
        }

        const resize = () => {
            viewportHeight = node.clientHeight;
        };
        const observer = new ResizeObserver(resize);
        observer.observe(node);
        resize();

        return () => observer.disconnect();
    });

    onDestroy(() => {
        stopLive();
        if (filterTimer) clearTimeout(filterTimer);
    });
</script>

<Dialog.Root bind:open>
    <Dialog.Trigger tabindex={-1}>
        {#snippet child({ props })}
            <Button {...props} variant="primary" size="sm" icon="ListFilter" label={triggerLabel} />
        {/snippet}
    </Dialog.Trigger>

    <Dialog.Portal>
        <MyDialog class="w-full h-full flex flex-col max-h-none max-w-none rounded-none p-0! bg-(--light-bg1) text-(--dark-bg1)">
            <div class="flex h-full min-h-0 flex-col overflow-hidden">
                <div class="flex h-14 shrink-0 items-center justify-between border-b border-(--light-bg3) bg-(--light-bg1) px-6">
                    <div class="min-w-0">
                        <Dialog.Title class="truncate text-lg font-extrabold text-(--dark-bg1)">
                            {title}
                        </Dialog.Title>
                        <Dialog.Description class="truncate text-sm text-(--grey)">
                            {description}
                        </Dialog.Description>
                    </div>

                    <Dialog.Close>
                        {#snippet child({ props })}
                            <Button {...props} variant="ghost" icon="X" class="size-8 bg-transparent px-0 hover:bg-(--light-bg3)" />
                        {/snippet}
                    </Dialog.Close>
                </div>

                <div class="flex shrink-0 flex-wrap items-center gap-3 border-b border-(--light-bg3) bg-(--light-bg1) px-6 py-3">
                    <div class="w-full max-w-96 min-w-56">
                        <TextInput
                            name="log-search"
                            icon="Search"
                            iconSide="left"
                            placeholder="Rechercher dans les logs..."
                            bind:value={search}
                        />
                    </div>

                    <div class="flex gap-1">
                        {#each ["all", "info", "warning", "error"] as filterLevel}
                            <Button
                                variant={level === filterLevel ? "primary" : "secondary"}
                                size="sm"
                                label={levelLabels[filterLevel as ServerLogLevel]}
                                class="w-fit"
                                onclick={() => level = filterLevel as ServerLogLevel}
                            />
                        {/each}
                    </div>

                    <div class="ml-auto flex items-center gap-1">
                        <Button
                            variant={liveEnabled ? "success" : "secondary"}
                            size="sm"
                            icon={liveConnecting ? "LoaderCircle" : "Radio"}
                            iconAnimation={liveConnecting ? "spin" : undefined}
                            tooltip={liveEnabled ? "Désactiver le live" : "Activer le live"}
                            aria-label={liveEnabled ? "Désactiver le live" : "Activer le live"}
                            class="size-8 px-0"
                            onclick={() => liveEnabled = !liveEnabled}
                        />
                        <Button
                            variant="secondary"
                            size="sm"
                            icon={loading ? "LoaderCircle" : "RefreshCw"}
                            iconAnimation={loading ? "spin" : undefined}
                            tooltip="Actualiser"
                            aria-label="Actualiser"
                            class="size-8 px-0"
                            disabled={loading}
                            onclick={() => void resetLogs()}
                        />
                    </div>
                </div>

                <div class="flex min-h-0 flex-1 flex-col font-mono text-xs" role="table" aria-label="Logs serveur">
                    <div class="log-row shrink-0 items-center border-b border-(--light-bg3) bg-(--light-bg2) px-4 py-2 font-semibold text-(--dark-bg1)" role="row">
                        <span role="columnheader">Niveau</span>
                        <span role="columnheader">Date</span>
                        <span role="columnheader">Adresse IP</span>
                        <span class="text-right" role="columnheader">Durée</span>
                        <span role="columnheader">Utilisateur</span>
                        <span role="columnheader">Méthode</span>
                        <span role="columnheader">Statut</span>
                        <span role="columnheader">URL</span>
                    </div>

                    <div
                        bind:this={viewport}
                        class="min-h-0 flex-1 overflow-auto bg-(--light-bg2)"
                        role="rowgroup"
                        onscroll={handleScroll}
                    >
                        {#if loading && !rows.length}
                            <div class="flex h-full items-center justify-center text-(--grey)">Chargement des logs...</div>
                        {:else if error && !rows.length}
                            <div class="flex h-full items-center justify-center text-(--red)">{error}</div>
                        {:else if !rows.length}
                            <div class="flex h-full items-center justify-center text-(--grey)">{emptyLogMessage()}</div>
                        {:else}
                            <div style={`height: ${topPadding}px;`}></div>
                            {#each visibleRows as row (row.id)}
                                {@const parsed = parseLog(row.text)}
                                {@const content = contentText(row, parsed)}
                                <div class={`log-row min-h-6 h-6 items-center px-4 leading-none ${rowBackgroundClass(row.level)}`} role="row">
                                    <span class={`font-bold ${rowLevelClass(row.level)}`} role="cell">{parsed?.level ?? row.level.toUpperCase()}</span>
                                    <span class="truncate text-(--grey)" role="cell">{parsed?.date ?? ""}</span>
                                    <span class="truncate text-(--grey)" role="cell">{parsed?.ip ?? ""}</span>
                                    <span class="text-right text-violet-600" role="cell">{parsed?.duration ?? ""}</span>
                                    <span class="truncate text-(--grey)" role="cell">{row.user ?? parsed?.user ?? ""}</span>
                                    <span class="font-semibold text-(--dark-bg1)" role="cell">{parsed?.method ?? ""}</span>
                                    <span class={`font-semibold ${statusClass(parsed?.status)}`} role="cell">{parsed?.status ?? ""}</span>
                                    <span class="min-w-0 truncate text-(--dark-bg1)" role="cell">
                                        {#each highlightSegments(content) as segment}
                                            {#if segment.match}
                                                <mark class="rounded-sm bg-yellow-200 px-0.5 text-inherit">{segment.text}</mark>
                                            {:else}
                                                {segment.text}
                                            {/if}
                                        {/each}
                                    </span>
                                </div>
                            {/each}
                            <div style={`height: ${bottomPadding}px;`}></div>
                            {#if loadingOlder}
                                <div class="flex h-10 items-center justify-center text-(--grey)">Chargement...</div>
                            {/if}
                        {/if}
                    </div>
                </div>
            </div>
        </MyDialog>
    </Dialog.Portal>
</Dialog.Root>

<style>
    .log-row {
        display: grid;
        grid-template-columns: 4.25rem 14rem 7.5rem 3.75rem 4.5rem 4rem 3.25rem minmax(0, 1fr);
        gap: 0.5rem;
    }
</style>
