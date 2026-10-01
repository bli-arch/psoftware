<script lang="ts">
    import FormSuccess from "./FormSuccess.svelte";

    let { client }: {
        client?: Record<string, any> | null;
    } = $props();

    const clientRef = $derived(client?.uid ?? client?.id ?? client?.pk ?? "");
</script>

<FormSuccess
    title="Client enregistré"
    detail={clientRef ? String(clientRef) : undefined}
/>
