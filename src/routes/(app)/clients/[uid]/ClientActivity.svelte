<script lang="ts">
    import ActivityTimeline from "$lib/components/activity/ActivityTimeline.svelte";
    import type { ActivityPrivacyMap } from "$lib/components/activity/activityPrivacy";

    let {
        clientId,
        order = "desc",
        onLoaded,
        privacy = {},
        privacyReady = true,
    } = $props<{
        clientId: number | null;
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
    entityId={clientId}
    endpoint="/core/client-activities"
    queryParam="client"
    {order}
    {privacy}
    {privacyReady}
    createdAction="a créé le client"
    modifiedAction="a modifié le client"
    emptyText="Les changements de ce client apparaîtront ici."
    {onLoaded}
/>
