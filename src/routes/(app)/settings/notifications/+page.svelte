<script lang="ts">
    import { SettingsExpandableRow, SettingsGroup, SettingsPage, SettingsRow, SettingsSection, SettingsToggleRow } from "$lib/components/settings";
    import { Button, Select, TextInput } from "$lib/components/istyler";
    import { appSettings } from "$lib/settings";
    import { operationPluralLower, operationSingularLower } from "$lib/operationDisplay";

    let pauseDuration = $state("1h");
    let notifications = $state({
        local: true,
        desktop: false,
        sounds: true,
        loginAlerts: true,
        operationAlerts: true,
        clientAlerts: false,
        quietHours: false,
    });
</script>

<SettingsPage
    title="Notifications"
    description="Configurez les canaux, alertes et périodes de silence."
>
    <SettingsSection label="Canaux">
        <SettingsToggleRow
            icon="Bell"
            title="✘ Notifications locales"
            description="Autorise les notifications internes à l’application."
            name="local-notifications"
            toneClass="bg-blue-50 text-blue-700"
            bind:value={notifications.local}
        />
        <SettingsExpandableRow
            icon="Monitor"
            title="✘ Notifications de bureau"
            description="Autorise les notifications du système."
            name="desktop-notifications"
            toneClass="bg-violet-50 text-violet-700"
            bind:value={notifications.desktop}
        />
        <SettingsToggleRow
            icon="Volume2"
            title="✘ Sons"
            description="Active ou désactive les sons de notification."
            name="notification-sounds"
            toneClass="bg-amber-50 text-amber-700"
            bind:value={notifications.sounds}
        />
    </SettingsSection>

    <SettingsSection label="Alertes">
        <SettingsToggleRow
            icon="LogIn"
            title="✘ Alertes de connexion"
            description="Notifie les nouvelles connexions au compte."
            name="login-alerts"
            toneClass="bg-red-50 text-red-700"
            bind:value={notifications.loginAlerts}
        />
        <SettingsToggleRow
            icon={$appSettings.value.operation.operationIcon}
            title={`✘ Alertes de ${operationSingularLower($appSettings.value.operation)}`}
            description={`Notifie les changements liés aux ${operationPluralLower($appSettings.value.operation)}.`}
            name="operation-alerts"
            toneClass="bg-emerald-50 text-emerald-700"
            bind:value={notifications.operationAlerts}
        />
        <SettingsToggleRow
            icon="BookUser"
            title="✘ Alertes client"
            description="Notifie les événements liés aux clients."
            name="client-alerts"
            toneClass="bg-blue-50 text-blue-700"
            bind:value={notifications.clientAlerts}
        />
    </SettingsSection>

    <SettingsSection label="Silence">
        <SettingsExpandableRow
            icon="Moon"
            title="✘ Heures silencieuses"
            description="Coupe les notifications pendant certaines heures."
            name="quiet-hours"
            toneClass="bg-stone-100 text-stone-700"
            bind:value={notifications.quietHours}
            bodyPadding={false}
        >
            <SettingsGroup>
                <SettingsRow title="✘ Début" description="Heure de début des heures silencieuses." inline={true}>
                    {#snippet action()}
                        <div class="w-36">
                            <TextInput name="quiet-start" label="Début" value="20:00" />
                        </div>
                    {/snippet}
                </SettingsRow>
                <SettingsRow title="✘ Fin" description="Heure de fin des heures silencieuses." inline={true}>
                    {#snippet action()}
                        <div class="w-36">
                            <TextInput name="quiet-end" label="Fin" value="08:00" />
                        </div>
                    {/snippet}
                </SettingsRow>
            </SettingsGroup>
        </SettingsExpandableRow>
        <SettingsRow
            icon="BellOff"
            title="✘ Désactiver temporairement les notifications"
            description="Met les notifications en pause."
            toneClass="bg-orange-50 text-orange-700"
        >
            {#snippet action()}
                <div class="flex items-end gap-2">
                    <div class="w-40">
                        <Select
                            name="pause-notifications"
                            label="Durée"
                            bind:value={pauseDuration}
                            allowDeselect={false}
                            options={[
                                { label: "1 heure", value: "1h" },
                                { label: "Aujourd’hui", value: "today" },
                                { label: "Jusqu’à demain", value: "tomorrow" },
                            ]}
                        />
                    </div>
                    <Button variant="secondary" size="sm" icon="Pause" label="Pause" />
                </div>
            {/snippet}
        </SettingsRow>
    </SettingsSection>
</SettingsPage>
