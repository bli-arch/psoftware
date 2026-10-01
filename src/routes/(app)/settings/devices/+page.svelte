<script lang="ts">
    import { SettingsExpandableRow, SettingsGroup, SettingsPage, SettingsRow, SettingsSection, SettingsToggleRow } from "$lib/components/settings";
    import { Button, NumberInput, TextInput } from "$lib/components/istyler";

    let scanMinLength = $state(6);
    let scannerPattern = $state("");
    let scannerTest = $state("");
    let devices = $state({
        scanner: true,
        scannerSound: true,
        printPreview: true,
    });
</script>

<SettingsPage
    title="Appareils"
    description="Contrôlez les scanners, imprimantes et périphériques utilisés par l’application."
>
    <SettingsSection label="Scanner">
        <SettingsExpandableRow
            icon="ScanBarcode"
            title="✘ Scanner de codes-barres"
            description="Active la prise en charge d’un scanner."
            name="barcode-scanner"
            toneClass="bg-emerald-50 text-emerald-700"
            bind:value={devices.scanner}
            bodyPadding={false}
        >
            <SettingsGroup>
                <SettingsRow
                    title="✘ Longueur minimale du code-barres"
                    description="Ignore les codes trop courts."
                    inline={true}
                >
                    {#snippet action()}
                        <div class="w-36">
                            <NumberInput name="scan-min-length" label="Longueur" min={1} max={64} bind:value={scanMinLength} />
                        </div>
                    {/snippet}
                </SettingsRow>
                <SettingsRow
                    title="✘ Expression de validation"
                    description="Filtre les codes acceptés."
                    inline={true}
                >
                    {#snippet action()}
                        <div class="w-64">
                            <TextInput name="scanner-pattern" label="Regex" placeholder="Optionnel" bind:value={scannerPattern} />
                        </div>
                    {/snippet}
                </SettingsRow>
                <SettingsRow
                    title="✘ Tester le scanner"
                    description="Vérifie que le scanner fonctionne correctement."
                    inline={true}
                >
                    {#snippet action()}
                        <div class="flex items-end gap-2">
                            <div class="w-52">
                                <TextInput name="scanner-test" label="Code" bind:value={scannerTest} />
                            </div>
                            <Button variant="secondary" size="sm" icon="ScanLine" label="Tester" />
                        </div>
                    {/snippet}
                </SettingsRow>
            </SettingsGroup>
        </SettingsExpandableRow>
        <SettingsToggleRow
            icon="Volume2"
            title="✘ Signal sonore du scanner"
            description="Joue un son après un scan réussi."
            name="scanner-sound"
            toneClass="bg-amber-50 text-amber-700"
            bind:value={devices.scannerSound}
        />
    </SettingsSection>

    <SettingsSection label="Impression">
        <SettingsToggleRow
            icon="FileSearch"
            title="✘ Aperçu avant impression"
            description="Affiche un aperçu avant impression."
            name="print-preview"
            toneClass="bg-violet-50 text-violet-700"
            bind:value={devices.printPreview}
        />
    </SettingsSection>
</SettingsPage>
