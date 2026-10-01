use tauri::WebviewWindow;

pub async fn clear(window: WebviewWindow) -> Result<(), String> {
    platform::clear(window).await
}

#[cfg(windows)]
mod platform {
    use std::sync::{Arc, Mutex};
    use std::time::Duration;

    use tauri::WebviewWindow;
    use tokio::sync::oneshot;
    use webview2_com::ClearBrowsingDataCompletedHandler;
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2Profile2, ICoreWebView2_13, COREWEBVIEW2_BROWSING_DATA_KINDS_DISK_CACHE,
    };
    use windows::core::Interface;

    pub async fn clear(window: WebviewWindow) -> Result<(), String> {
        let (sender, receiver) = oneshot::channel::<Result<(), String>>();
        let sender = Arc::new(Mutex::new(Some(sender)));
        let callback_sender = Arc::clone(&sender);
        let schedule_sender = Arc::clone(&sender);

        let schedule_result = window.with_webview(move |platform_webview| {
            let result = (|| -> Result<(), String> {
                let webview: ICoreWebView2_13 = unsafe {
                    platform_webview
                        .controller()
                        .CoreWebView2()
                        .and_then(|webview| webview.cast())
                }
                .map_err(|error| format!("Cache WebView2 indisponible : {error}"))?;
                let profile: ICoreWebView2Profile2 = unsafe { webview.Profile() }
                    .and_then(|profile| profile.cast())
                    .map_err(|error| format!("Profil WebView2 indisponible : {error}"))?;
                let handler =
                    ClearBrowsingDataCompletedHandler::create(Box::new(move |error_code| {
                        let result = error_code
                            .map_err(|error| format!("Impossible de vider le cache : {error}"));
                        if let Some(sender) =
                            callback_sender.lock().ok().and_then(|mut slot| slot.take())
                        {
                            let _ = sender.send(result);
                        }
                        Ok(())
                    }));

                unsafe {
                    profile.ClearBrowsingData(COREWEBVIEW2_BROWSING_DATA_KINDS_DISK_CACHE, &handler)
                }
                .map_err(|error| format!("Impossible de démarrer le nettoyage : {error}"))
            })();

            if let Err(error) = result {
                if let Some(sender) = schedule_sender.lock().ok().and_then(|mut slot| slot.take()) {
                    let _ = sender.send(Err(error));
                }
            }
        });

        if let Err(error) = schedule_result {
            if let Some(sender) = sender.lock().ok().and_then(|mut slot| slot.take()) {
                let _ = sender.send(Err(format!("Fenêtre WebView2 indisponible : {error}")));
            }
        }

        tokio::time::timeout(Duration::from_secs(30), receiver)
            .await
            .map_err(|_| {
                "WebView2 n’a pas terminé le nettoyage dans le délai imparti.".to_string()
            })?
            .map_err(|_| "Le suivi du nettoyage du cache a été interrompu.".to_string())?
    }
}

#[cfg(not(windows))]
mod platform {
    use tauri::WebviewWindow;

    pub async fn clear(_window: WebviewWindow) -> Result<(), String> {
        Err("Le nettoyage du cache WebView2 est uniquement disponible sous Windows.".into())
    }
}
