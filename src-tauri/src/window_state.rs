use crate::app_data;
use serde::{Deserialize, Serialize};
use std::fs::{File, OpenOptions};
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use tauri::{App, AppHandle, Monitor, Runtime, WebviewWindow, WebviewWindowBuilder, WindowEvent};

const STATE_FILE_NAME: &str = "window-state.json";
const MIN_WIDTH: u32 = 800;
const MIN_HEIGHT: u32 = 520;
const MAX_WIDTH: u32 = 7680;
const MAX_HEIGHT: u32 = 4320;
const MIN_VISIBLE_PX: i32 = 80;

static WINDOW_STATE: OnceLock<Mutex<WindowState>> = OnceLock::new();

#[derive(Clone, Debug, Deserialize, Serialize)]
struct WindowState {
    remember: bool,
    bounds: Option<WindowBounds>,
}

impl Default for WindowState {
    fn default() -> Self {
        Self {
            remember: true,
            bounds: None,
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
struct WindowBounds {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

pub fn create_main_window(app: &mut App) -> tauri::Result<()> {
    create_main_window_from_handle(app.handle())
}

pub fn create_main_window_from_handle<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let config = app
        .config()
        .app
        .windows
        .first()
        .ok_or_else(|| tauri::Error::WindowLabelAlreadyExists("main".into()))?;
    let state = state_snapshot();
    let monitors = app.available_monitors().unwrap_or_default();
    let saved_bounds = state
        .remember
        .then(|| state.bounds.as_ref())
        .flatten()
        .and_then(|bounds| valid_bounds(bounds, &monitors));

    let mut builder = WebviewWindowBuilder::from_config(app, config)?;
    if let Some((bounds, scale_factor)) = saved_bounds {
        let scale_factor = if scale_factor > 0.0 {
            scale_factor
        } else {
            1.0
        };
        builder = builder
            .inner_size(
                bounds.width as f64 / scale_factor,
                bounds.height as f64 / scale_factor,
            )
            .position(
                bounds.x as f64 / scale_factor,
                bounds.y as f64 / scale_factor,
            );
    } else {
        builder = builder.center();
    }

    let window = builder.build()?;
    watch_main_window(&window);
    Ok(())
}

pub fn set_remember_window_bounds(remember: bool) -> Result<(), String> {
    let mut state = state_store()
        .lock()
        .map_err(|_| "Window state is unavailable.".to_string())?;
    state.remember = remember;
    if !remember {
        state.bounds = None;
    }
    save_state(&state)
}

fn watch_main_window<R: Runtime>(window: &WebviewWindow<R>) {
    let tracked_window = window.clone();
    window.on_window_event(move |event| match event {
        WindowEvent::Moved(_) | WindowEvent::Resized(_) => {
            update_current_bounds(&tracked_window, false);
        }
        WindowEvent::CloseRequested { .. } | WindowEvent::Destroyed => {
            update_current_bounds(&tracked_window, true);
        }
        _ => {}
    });
}

fn update_current_bounds<R: Runtime>(window: &WebviewWindow<R>, flush: bool) {
    let Ok(mut state) = state_store().lock() else {
        return;
    };
    if !state.remember {
        return;
    }

    let Ok(position) = window.outer_position() else {
        return;
    };
    let Ok(size) = window.inner_size() else {
        return;
    };

    let bounds = WindowBounds {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
    };
    if !valid_size(bounds.width, bounds.height) {
        return;
    }

    state.bounds = Some(bounds);
    if flush {
        let _ = save_state(&state);
    }
}

fn state_store() -> &'static Mutex<WindowState> {
    WINDOW_STATE.get_or_init(|| Mutex::new(read_state_file()))
}

fn state_snapshot() -> WindowState {
    state_store()
        .lock()
        .map(|state| state.clone())
        .unwrap_or_default()
}

fn valid_bounds<'a>(
    bounds: &'a WindowBounds,
    monitors: &'a [Monitor],
) -> Option<(&'a WindowBounds, f64)> {
    if !valid_size(bounds.width, bounds.height) {
        return None;
    }

    if monitors.is_empty() {
        return Some((bounds, 1.0));
    }

    monitors
        .iter()
        .find(|monitor| intersects_work_area(bounds, monitor))
        .map(|monitor| (bounds, monitor.scale_factor()))
}

fn valid_size(width: u32, height: u32) -> bool {
    (MIN_WIDTH..=MAX_WIDTH).contains(&width) && (MIN_HEIGHT..=MAX_HEIGHT).contains(&height)
}

fn intersects_work_area(bounds: &WindowBounds, monitor: &Monitor) -> bool {
    let area = monitor.work_area();
    let position = area.position;
    let size = area.size;

    let left = bounds.x;
    let top = bounds.y;
    let right = left.saturating_add(bounds.width as i32);
    let bottom = top.saturating_add(bounds.height as i32);
    let area_left = position.x;
    let area_top = position.y;
    let area_right = area_left.saturating_add(size.width as i32);
    let area_bottom = area_top.saturating_add(size.height as i32);

    right > area_left + MIN_VISIBLE_PX
        && bottom > area_top + MIN_VISIBLE_PX
        && left < area_right - MIN_VISIBLE_PX
        && top < area_bottom - MIN_VISIBLE_PX
}

fn state_path() -> Result<PathBuf, String> {
    let mut directory = app_data::directory()?.to_path_buf();
    std::fs::create_dir_all(&directory)
        .map_err(|error| format!("Unable to create window state directory: {error}"))?;
    directory.push(STATE_FILE_NAME);
    Ok(directory)
}

fn read_state_file() -> WindowState {
    let Ok(path) = state_path() else {
        return WindowState::default();
    };

    match File::open(path) {
        Ok(mut file) => {
            let mut contents = String::new();
            if file.read_to_string(&mut contents).is_err() {
                return WindowState::default();
            }
            serde_json::from_str(&contents).unwrap_or_default()
        }
        Err(_) => WindowState::default(),
    }
}

fn save_state(state: &WindowState) -> Result<(), String> {
    let path = state_path()?;
    let mut file = OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .open(path)
        .map_err(|error| format!("Unable to write window state file: {error}"))?;
    let contents = serde_json::to_string_pretty(state)
        .map_err(|error| format!("Unable to serialize window state: {error}"))?;

    file.write_all(contents.as_bytes())
        .map_err(|error| format!("Unable to save window state: {error}"))
}
