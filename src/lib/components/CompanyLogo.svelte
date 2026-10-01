<script lang="ts">
    import { companyBranding } from "$lib/companyBranding";

    type Props = {
        alt?: string;
        class?: string;
    };

    let {
        alt = "Logo de l’entreprise",
        class: className = "",
    }: Props = $props();
    let failedUrl = $state<string | null>(null);
    const logoUrl = $derived($companyBranding.logoUrl === failedUrl ? null : $companyBranding.logoUrl);
</script>

<div class={`flex items-center justify-center ${className}`}>
    {#if logoUrl}
        <img
            src={logoUrl}
            {alt}
            class="max-h-full max-w-full object-contain"
            onerror={() => failedUrl = logoUrl}
        />
    {:else}
        <svg class="h-full w-full text-(--user-color)" viewBox="0 0 100 100" fill="none" aria-label="Logo PSoftware">
            <path
                d="M83.5609 23.1057L75.7735 44.8362C75.1662 46.5308 74.6567 48.255 74.2457 50C74.6567 51.745 75.1662 53.4692 75.7735 55.1638L83.5609 76.8943C84.2373 78.7816 81.9409 80.2839 80.5819 78.8431L74.1851 72.0608L78.8896 97.7832C79.277 99.9014 76.4568 100.895 75.513 98.9733L66.3321 80.2757C63.6624 74.8386 59.6228 70.2479 54.64 66.9882C49.6571 63.7284 43.9157 61.9207 38.0219 61.7556L17.7538 61.1882C15.6703 61.1298 15.3301 58.0684 17.3466 57.5227L44.0946 50.2847C44.4308 50.1938 44.7657 50.0988 45.0993 50C44.7657 49.9012 44.4308 49.8062 44.0946 49.7153L17.3466 42.4773C15.3301 41.9316 15.6703 38.8702 17.7538 38.8118L38.0219 38.2444C43.9157 38.0794 49.6571 36.2716 54.64 33.0118C59.6228 29.7521 63.6624 25.1614 66.3321 19.7243L75.513 1.02666C76.4568 -0.895413 79.277 0.0985982 78.8896 2.21678L74.1851 27.9392L80.5819 21.1569C81.9409 19.7161 84.2373 21.2184 83.5609 23.1057Z"
                fill="currentColor"
            />
        </svg>
    {/if}
</div>
