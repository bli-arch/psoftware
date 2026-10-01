<script lang="ts">
    export let end: boolean = false
</script>

<div class="container flex gap-1 w-full flex-col"
    class:mt-auto={end}>

    <slot />
</div>
