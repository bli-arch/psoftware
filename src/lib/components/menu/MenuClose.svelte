<!-- MenuClose.svelte -->
<script lang="ts">
  import { Button } from "bits-ui";
  import { getSidebarState } from "./sidebarState";

  // just need to know which sidebar we're tied to
  export let id: string;

  const { collapsed, toggle } = getSidebarState(id);

  let className: string | undefined | null = undefined;
  export { className as class };
</script>

<Button.Root
  onclick={toggle}
  class={className}
  aria-pressed={$collapsed}
>
  <slot />
</Button.Root>
