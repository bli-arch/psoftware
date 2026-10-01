<script lang="ts">
    import { appSettings } from "$lib/settings";
    import { operationSingularLower } from "$lib/operationDisplay";
    import ActivityTimeline from "$lib/components/activity/ActivityTimeline.svelte";
    import type { ActivityPrivacyMap } from "$lib/components/activity/activityPrivacy";

    let {
        operationId,
        states = [],
        order = "desc",
        onLoaded,
        privacy = {},
        privacyReady = true,
    } = $props<{
        operationId: number | null;
        states?: Array<Record<string, any>>;
        order?: "asc" | "desc";
        onLoaded?: (activities: any[]) => void;
        privacy?: ActivityPrivacyMap;
        privacyReady?: boolean;
    }>();

    let timeline: { refresh?: () => Promise<void> } | null = $state(null);

    export async function refresh() {
        await timeline?.refresh?.();
    }
</script>

<ActivityTimeline
    bind:this={timeline}
    entityId={operationId}
    endpoint="/core/activities"
    queryParam="operation"
    {states}
    {order}
    {privacy}
    {privacyReady}
    createdAction={`a créé ${operationSingularLower($appSettings.value.operation)}`}
    modifiedAction={`a modifié ${operationSingularLower($appSettings.value.operation)}`}
    emptyText={`Les changements de cette ${operationSingularLower($appSettings.value.operation)} apparaîtront ici.`}
    {onLoaded}
/>
